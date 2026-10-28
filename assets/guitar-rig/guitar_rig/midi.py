"""MIDI in/out.

Roles follow GarageBand's export: the "Guitar riff" track (channel 0) is rhythm guitar, "Bass" (channel 1) is skipped,
"Lead" (channel 2) is lead guitar. Track names win over channel numbers when they say something. Palm mutes are
inferred, as there is no MIDI for them: a short, low note played alone (a chug) is muted; chords and long notes ring.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, replace

import mido
import numpy as np

from .synth import Note

TPB = 480
BEND_RANGE = 2.0         # semitones at full pitch-wheel travel (GarageBand default)
LEAD_VIB_MIN = 0.4       # s: lead notes at least this long get vibrato
MUTE_MAX_DUR = 0.22      # s
MUTE_MAX_PITCH = 55      # MIDI, G3
RHYTHM_CH, BASS_CH, LEAD_CH = 0, 1, 2


@dataclass(frozen=True)
class Song:
    rhythm: tuple[Note, ...]
    lead: tuple[Note, ...]
    bpm: float


def _role(track_name, channel):
    n = track_name.lower()
    if "bass" in n:
        return "bass"
    if "lead" in n or "solo" in n:
        return "lead"
    if "guitar" in n or "riff" in n or "rhythm" in n:
        return "rhythm"
    return {BASS_CH: "bass", LEAD_CH: "lead"}.get(channel, "rhythm")


def _bend(points, start, end):
    """Pitch-wheel curve inside a note as (seconds since start, semitones); () when it stays flat."""
    cur, inside = 0.0, []
    for t, s in points:
        if t <= start:
            cur = s
        elif t < end:
            inside.append((t - start, s))
    curve = ((0.0, cur), *inside)
    return curve if any(abs(s) > 0.01 for _, s in curve) else ()


def _mark_mutes(notes, mode):
    if mode == "off":
        return list(notes)
    onsets = Counter(round(n.start * 200) for n in notes)
    return [
        replace(n, mute=True)
        if mode == "all" or (n.dur <= MUTE_MAX_DUR and n.pitch <= MUTE_MAX_PITCH and onsets[round(n.start * 200)] == 1)
        else n
        for n in notes
    ]


def read_midi(path, mute="auto"):
    mid = mido.MidiFile(str(path))
    roles = {}
    for track in mid.tracks:
        name = next((m.name for m in track if m.type == "track_name"), "")
        for m in track:
            if m.type in ("note_on", "note_off", "pitchwheel"):
                roles.setdefault(m.channel, _role(name, m.channel))

    t, bpm = 0.0, None
    held: dict[tuple[int, int], list[tuple[float, int]]] = {}
    spans = []
    wheel: dict[int, list[tuple[float, float]]] = {}
    for msg in mid:
        t += msg.time
        if msg.type == "set_tempo" and bpm is None:
            bpm = mido.tempo2bpm(msg.tempo)
        elif msg.type == "pitchwheel":
            wheel.setdefault(msg.channel, []).append((t, msg.pitch / 8192 * BEND_RANGE))
        elif msg.type == "note_on" and msg.velocity > 0:
            held.setdefault((msg.channel, msg.note), []).append((t, msg.velocity))
        elif msg.type in ("note_off", "note_on") and held.get((msg.channel, msg.note)):
            s, v = held[(msg.channel, msg.note)].pop(0)
            spans.append((msg.channel, s, t, msg.note, v))
    for (ch, p), stack in held.items():
        spans.extend((ch, s, t, p, v) for s, v in stack)

    rhythm, lead = [], []
    for ch, s, e, p, v in sorted(spans, key=lambda x: (x[1], x[3])):
        role = roles.get(ch, "rhythm")
        if role == "bass":
            continue
        dur = e - s
        note = Note(s, dur, p, v / 127, vib=role == "lead" and dur >= LEAD_VIB_MIN,
                    bend=_bend(wheel.get(ch, []), s, e))
        (lead if role == "lead" else rhythm).append(note)
    return Song(tuple(_mark_mutes(rhythm, mute)), tuple(lead), bpm or 120.0)


def write_midi(path, rhythm, lead, bpm):
    """Notes in seconds → a 3-track file laid out like GarageBand's export (rhythm ch0, lead ch2 with pitch bends)."""
    to_tick = lambda sec: int(round(sec * bpm / 60 * TPB))
    # at one tick: note-off, then wheel reset, then wheel set, then note-on
    OFF, RESET, SET, ON = 1, 2, 3, 4

    def track(name, notes, channel):
        ev = []
        for n in notes:
            a, b = to_tick(n.start), to_tick(n.start + n.dur)
            if n.bend:
                bt, bs = zip(*n.bend)
                last = None
                for tt in np.arange(0.0, n.dur, 0.01):
                    w = int(np.clip(np.interp(tt, bt, bs) / BEND_RANGE * 8192, -8192, 8191))
                    if w != last:
                        ev.append((to_tick(n.start + tt), SET, mido.Message("pitchwheel", channel=channel, pitch=w)))
                        last = w
                ev.append((b, RESET, mido.Message("pitchwheel", channel=channel, pitch=0)))
            ev.append((a, ON, mido.Message("note_on", channel=channel, note=int(n.pitch),
                                           velocity=max(1, round(n.vel * 127)))))
            ev.append((b, OFF, mido.Message("note_off", channel=channel, note=int(n.pitch), velocity=0)))
        tr = mido.MidiTrack([mido.MetaMessage("track_name", name=name, time=0)])
        prev = 0
        for tick, _, msg in sorted(ev, key=lambda e: (e[0], e[1])):
            tr.append(msg.copy(time=tick - prev))
            prev = tick
        return tr

    mid = mido.MidiFile(type=1, ticks_per_beat=TPB)
    head = mido.MidiTrack([mido.MetaMessage("track_name", name="riff", time=0),
                           mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(bpm), time=0)])
    mid.tracks.extend([head, track("Guitar riff", rhythm, RHYTHM_CH), track("Lead", lead, LEAD_CH)])
    mid.save(str(path))
