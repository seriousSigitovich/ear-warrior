"""5 lyrical guitar solos (~7-8 s each) over a drum kit, rendered through assets/guitar-rig.

Run (from assets/solo/beautiful):
    ../../guitar-rig/.venv/bin/python compose.py            # all five
    ../../guitar-rig/.venv/bin/python compose.py 03         # one

Writes NN-name.mp3 (guitar + drums) and NN-name.mid (rhythm ch0 + lead ch2, GarageBand layout, no drums), and
prints the lead line as note names. Every lead note sits on the 12-fret neck (E2-E5) so it can be answered in the app.
"""
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent / "guitar-rig"))

from guitar_rig.midi import Song, write_midi            # noqa: E402
from guitar_rig.render import render_song, to_lufs, write_wav   # noqa: E402
from guitar_rig.synth import SR, Note                  # noqa: E402

NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
name = lambda m: f"{NAMES[m % 12]}{m // 12 - 1}"
VIB_MIN = 0.4   # s, same rule as guitar_rig.midi


@dataclass
class Solo:
    id: str
    title: str
    bpm: float
    beats: float
    amp: str
    lead: list = field(default_factory=list)      # (beat, len, pitch, bend[(beat, semis)])
    rhythm: list = field(default_factory=list)    # Notes in beats, built by the helpers below
    drums: list = field(default_factory=list)     # (beat, kind, vel)
    tail: float = 0.9                             # s of ring after the last beat
    cap: float = 8.0                              # longest file, s (the mp3s are ~8 s Shorts material)


# ---- lead / rhythm helpers (times in beats) ---------------------------------
def n(beat, ln, pitch, *bend):
    return (beat, ln, pitch, bend)


def stab(beat, ln, root, vel=0.95):
    return [Note(beat, ln, p, vel) for p in (root, root + 7, root + 12)]


def chug(beat, root, vel=0.85, ln=0.4):
    return [Note(beat, ln, root, vel, mute=True)]


def chugs8(b0, b1, root, skip=()):
    out, b = [], b0
    while b < b1 - 1e-9:
        if b not in skip:
            out += chug(b, root, 0.8 if b % 1 else 0.9)
        b += 0.5
    return out


def arp(beat, ln, chord, vel=0.62):
    """Slowly rolled chord tones, each ringing `ln` beats."""
    return [Note(beat + i * 0.5, ln - i * 0.5, p, vel) for i, p in enumerate(chord)]


def seconds(notes, bpm):
    sp = 60.0 / bpm
    return [Note(x.start * sp, x.dur * sp, x.pitch, x.vel, x.mute, x.dur * sp >= VIB_MIN, x.bend) for x in notes]


def lead_notes(lead, bpm):
    sp = 60.0 / bpm
    out = []
    for beat, ln, pitch, bend in lead:
        dur = ln * sp * 0.96
        out.append(Note(beat * sp, dur, pitch, 0.9, vib=dur >= VIB_MIN, bend=tuple((b * sp, s) for b, s in bend)))
    return out


# ---- drum helpers -----------------------------------------------------------
def hats(b0, b1, step=0.5, vel=0.4, accent=0.6):
    out, b = [], b0
    while b < b1 - 1e-9:
        out.append((b, "hat", accent if abs(b % 1) < 1e-9 else vel))
        b += step
    return out


def roll(b0, b1, kind="snare", step=0.25, v0=0.3, v1=0.9):
    n_steps = int(round((b1 - b0) / step))
    return [(b0 + i * step, kind, v0 + (v1 - v0) * i / max(1, n_steps - 1)) for i in range(n_steps)]


def beat_list(beats, kind, vel):
    return [(b, kind, vel) for b in beats]


def bars(b0, b1, kicks, snares, hat_step=0.5, hat_vel=0.4):
    """Repeat a one-bar groove (positions inside a 4-beat bar) from b0 up to b1."""
    out, b = [], b0
    while b < b1 - 1e-9:
        out += beat_list([b + k for k in kicks if b + k < b1], "kick", 0.9)
        out += beat_list([b + s for s in snares if b + s < b1], "snare", 0.85)
        if hat_step:
            out += hats(b, min(b + 4, b1), hat_step, hat_vel)
        b += 4
    return out


# ---- the five solos ---------------------------------------------------------
def solo_01():
    """A minor ballad, half-time, rolled arpeggios under long singing notes."""
    am, f, g = [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59]
    s = Solo("01", "a-minor-ballad", 68, 8, "crunch", tail=0.9)
    s.lead = [
        n(0, 1.5, 76, (0, -2), (0.35, 0)), n(1.5, 0.5, 74),                  # E5 (bent up), D5
        n(2, 1, 72), n(3, 1, 69),                                            # C5, A4
        n(4, 1, 71), n(5, 0.5, 74), n(5.5, 0.5, 76),                         # B4, D5, E5
        n(6, 1, 76, (0, -2), (0.4, 0)), n(7, 1, 69),                         # E5 (bent up), A4
    ]
    s.rhythm = arp(0, 2, am) + arp(2, 2, f) + arp(4, 2, g) + arp(6, 2, am)
    s.drums = ([(0, "crash", 0.45)] + beat_list([0, 1.5, 4, 5.5], "kick", 0.85) + beat_list([2, 6], "snare", 0.8)
               + hats(0, 7) + beat_list([7, 7.5], "tom_hi", 0.6))
    return s


def solo_02():
    """E minor anthem: Em C G D / Em. Four-note hook, answered a step lower, then lifted."""
    s = Solo("02", "e-minor-anthem", 136, 16, "crunch", tail=0.9)
    s.lead = [
        n(0, 1, 71), n(1, 0.5, 74), n(1.5, 1, 76), n(2.5, 0.5, 74), n(3, 1, 71),         # B4 D5 E5 D5 B4
        n(4, 1, 67), n(5, 0.5, 71), n(5.5, 1, 72), n(6.5, 0.5, 71), n(7, 1, 67),         # G4 B4 C5 B4 G4
        n(8, 1, 74), n(9, 0.5, 71), n(9.5, 0.5, 74), n(10, 1.5, 76, (0, -2), (0.3, 0)),  # D5 B4 D5 E5(bent)
        n(11.5, 0.5, 74),                                                                # D5
        n(12, 0.5, 69), n(12.5, 0.5, 71), n(13, 0.5, 74), n(13.5, 0.5, 71),             # A4 B4 D5 B4
        n(14, 2, 76, (0, -2), (0.25, 0)),                                                # E5 (bent)
    ]
    for b0, root in [(0, 40), (4, 48), (8, 43), (12, 50)]:
        s.rhythm += stab(b0, 0.5, root) + chugs8(b0 + 0.5, b0 + 4, root)
    s.rhythm = [x for x in s.rhythm if not (x.start >= 14)] + stab(14, 2, 40)
    s.drums = ([(0, "crash", 0.7)] + bars(0, 13.5, [0, 2, 2.5], [1, 3]) + roll(13.5, 14, "snare", 0.125, 0.4, 0.9)
               + [(14, "crash", 0.9), (14, "kick", 1.0), (15, "snare", 0.85), (15.5, "kick", 0.8)])
    return s


def solo_03():
    """A minor blues, shuffle: call (bar 1), answer (bar 2), tension on E7, home."""
    t = 1 / 3
    s = Solo("03", "a-minor-blues-shuffle", 132, 16, "crunch", tail=0.9)
    s.lead = [
        n(0, 1, 76, (0, -2), (0.3, 0)), n(1, 2 * t, 72), n(1 + 2 * t, t, 74), n(2, 2 * t, 72), n(2 + 2 * t, t, 69),
        n(3, 1, 67),                                                                          # E5 C5 D5 C5 A4 G4
        n(4, 1, 74, (0, -2), (0.25, 0)), n(5, 2 * t, 72), n(5 + 2 * t, t, 69), n(6, 1, 72),  # D5 C5 A4 C5
        n(8, 1, 71), n(9, 1, 76), n(10, 2 * t, 74), n(10 + 2 * t, t, 71), n(11, 1, 68),     # B4 E5 D5 B4 G#4
        n(12, 1, 76, (0, -2), (0.3, 0)), n(13, 2 * t, 72), n(13 + 2 * t, t, 69), n(14, 2, 69),  # E5 C5 A4 A4
    ]
    for b0, root in [(0, 45), (4, 50), (8, 40), (12, 45)]:
        s.rhythm += stab(b0, 0.6, root)
        for b in range(int(b0) + 1, int(b0) + 4):
            s.rhythm += chug(b, root, 0.85, 0.35) + chug(b + 2 * t, root, 0.7, 0.2)
        s.rhythm += chug(b0 + 2 * t, root, 0.7, 0.2)
    s.rhythm = [x for x in s.rhythm if x.start < 14] + stab(14, 2, 45)
    d = []
    for b in range(0, 16):
        d += [(b, "hat", 0.55), (b + 2 * t, "hat", 0.3)]
    d += beat_list([0, 2, 4, 6, 8, 10, 12, 14], "kick", 0.9) + beat_list([1, 3, 5, 7, 9, 11, 13, 15], "snare", 0.8)
    d += [(11, "snare", 0.5), (11 + t, "snare", 0.6), (11 + 2 * t, "snare", 0.75)]
    d += [(0, "crash", 0.6), (12, "crash", 0.85)]
    s.drums = d
    return s


def solo_04():
    """D major, sunny and wide: F#-A-D opening, a falling line through A and Bm, G -> D landing."""
    s = Solo("04", "d-major-sunrise", 130, 16, "crunch", tail=0.9)
    s.lead = [
        n(0, 1, 66), n(1, 1, 69), n(2, 1.5, 74), n(3.5, 0.5, 73),                              # F#4 A4 D5 C#5
        n(4, 1, 71), n(5, 0.5, 69), n(5.5, 0.5, 71), n(6, 1, 73), n(7, 1, 76, (0, -2), (0.3, 0)),  # B4 A4 B4 C#5 E5
        n(8, 1.5, 74), n(9.5, 0.5, 71), n(10, 0.5, 74), n(10.5, 0.5, 76), n(11, 1, 74),        # D5 B4 D5 E5 D5
        n(12, 1, 71), n(13, 1, 76, (0, -2), (0.3, 0)), n(14, 2, 74),                           # B4 E5 D5
    ]
    for b0, root in [(0, 50), (4, 45), (8, 47), (12, 43)]:
        s.rhythm += stab(b0, 1.5, root) + stab(b0 + 1.5, 1, root, 0.85) + stab(b0 + 2.5, 1.5, root, 0.9)
    s.rhythm = [x for x in s.rhythm if x.start < 14] + stab(14, 2, 50)
    d = [(0, "crash", 0.7), (8, "crash", 0.8), (14, "crash", 0.9), (14, "kick", 1.0)]
    d += beat_list([b for b in range(14) if b != 13], "kick", 0.75)
    d += beat_list([1, 3, 5, 9, 11], "snare", 0.85) + hats(0, 13)
    d += roll(7, 8, "snare", 0.125, 0.4, 0.9) + roll(13, 14, "tom_mid", 0.25, 0.5, 0.9)
    d += beat_list([15], "snare", 0.85) + [(15.5, "kick", 0.8)]
    s.drums = d
    return s


def solo_05(bpm=140, tail=1.1, cap=8.0):
    """E harmonic minor, neoclassical: arpeggio sequence over Em - C, one falling/rising run on B, resolve to E."""
    em = [64, 67, 71, 67, 71, 76, 71, 67]
    c = [64, 67, 72, 67, 72, 76, 72, 67]
    desc = [76, 75, 72, 71, 69, 67, 66, 64]
    asc = [64, 66, 67, 69, 71, 72, 75, 76]
    s = Solo("05", "e-harmonic-minor-neoclassic", bpm, 16, "metal", tail=tail, cap=cap)
    for i, p in enumerate(em):
        s.lead.append(n(i * 0.5, 0.5, p))
    for i, p in enumerate(c):
        s.lead.append(n(4 + i * 0.5, 0.5, p))
    for i, p in enumerate(desc):
        s.lead.append(n(8 + i * 0.25, 0.25, p))
    s.lead += [n(10, 0.5, 71), n(10.5, 0.5, 75), n(11, 1, 75), n(12, 4, 76, (0, -1), (0.25, 0))]
    for b0, root in [(0, 40), (4, 48), (8, 47)]:
        s.rhythm += stab(b0, 0.5, root) + chugs8(b0 + 0.5, b0 + 4, root)
    s.rhythm += stab(12, 4, 40)
    d = [(0, "crash", 0.7), (12, "crash", 0.95), (12, "kick", 1.0)]
    d += bars(0, 11, [x * 0.5 for x in range(8)], [1, 3], 0.5, 0.35)
    d += roll(11, 12, "tom_hi", 0.25, 0.5, 0.9)
    d += beat_list([x * 0.5 for x in range(24, 32)], "kick", 0.8) + beat_list([13, 15], "snare", 0.85)
    s.drums = d
    return s


SOLOS = [solo_01, solo_02, solo_03, solo_04, solo_05]


# ---- drum kit (synthesized, numpy) ------------------------------------------
def _env(n_, decay):
    return np.exp(-np.arange(n_) / SR * decay)


def _hp(x, hz):
    return sosfilt(butter(2, hz, "hp", fs=SR, output="sos"), x)


def _bp(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], "bp", fs=SR, output="sos"), x)


def _sweep(f0, f1, dur, decay, k=30):
    t = np.arange(int(dur * SR)) / SR
    ph = np.cumsum(f1 + (f0 - f1) * np.exp(-t * k)) / SR
    return np.sin(2 * np.pi * ph) * _env(len(t), decay)


def kit(rng):
    k = _sweep(130, 46, 0.35, 9)
    click = rng.uniform(-1, 1, int(0.006 * SR)) * np.linspace(1, 0, int(0.006 * SR))
    k[: len(click)] += 0.35 * click
    sn_len = int(0.24 * SR)
    sn = _bp(rng.uniform(-1, 1, sn_len), 1500, 9000) * _env(sn_len, 20) * 0.9 + _sweep(210, 170, 0.24, 24, 40) * 0.55
    h_c = _hp(rng.uniform(-1, 1, int(0.07 * SR)), 7000) * _env(int(0.07 * SR), 70)
    ch_len = int(1.8 * SR)
    cr = _hp(rng.uniform(-1, 1, ch_len), 4500) * _env(ch_len, 2.6) * 0.8
    tom = lambda f: _sweep(f * 1.5, f, 0.35, 11, 18)
    return {"kick": k, "snare": sn, "hat": h_c, "crash": cr,
            "tom_hi": tom(190), "tom_mid": tom(150), "tom_low": tom(110)}


GAIN = {"kick": 1.0, "snare": 0.75, "hat": 0.28, "crash": 0.35, "tom_hi": 0.7, "tom_mid": 0.7, "tom_low": 0.7}
PAN = {"hat": 0.25, "crash": -0.3, "tom_hi": -0.2, "tom_mid": 0.0, "tom_low": 0.2}


def render_drums(drums, bpm, n_samples, seed=3):
    rng = np.random.default_rng(seed)
    voices = kit(rng)
    sp = 60.0 / bpm
    out = np.zeros((2, n_samples))
    for beat, kind, vel in sorted(drums):
        s0 = int(round(beat * sp * SR + rng.normal(0, 0.0015) * SR))
        v = voices[kind]
        a, b = max(0, s0), min(n_samples, s0 + len(v))
        if b <= a:
            continue
        pan = PAN.get(kind, 0.0)
        g = vel * GAIN[kind] * (0.93 + 0.14 * rng.random())
        seg = v[a - s0: b - s0] * g
        out[0, a:b] += seg * (1 - max(0, pan))
        out[1, a:b] += seg * (1 + min(0, pan))
    return out


# ---- render -----------------------------------------------------------------
DRUM_DB = -1.0   # drum bus level relative to the -14 LUFS reference, before the final loudness pass


def render(solo, out_dir, scratch, wav_to=None):
    rhythm = seconds(solo.rhythm, solo.bpm)
    lead = lead_notes(solo.lead, solo.bpm)
    if wav_to is None:
        write_midi(out_dir / f"{solo.id}-{solo.title}.mid", rhythm, lead, solo.bpm)

    song = Song(tuple(rhythm), tuple(lead), solo.bpm)
    guitar = render_song(song, solo.amp, takes=2, lufs=-18.0)
    total = min(solo.beats * 60 / solo.bpm + solo.tail, solo.cap)
    n_total = int(total * SR)
    guitar = guitar[:, :n_total] if guitar.shape[1] >= n_total else np.pad(guitar, ((0, 0), (0, n_total - guitar.shape[1])))

    drums = render_drums(solo.drums, solo.bpm, n_total)
    drums *= 10 ** ((-14.0 + DRUM_DB) / 20) / max(np.sqrt((drums ** 2).mean() * 4), 1e-9) * 0.5
    mix = (guitar + drums).astype(np.float32)
    fade = int(0.4 * SR)
    mix[:, -fade:] *= np.linspace(1, 0, fade)
    mix = to_lufs(mix, SR, -14.0)

    if wav_to is not None:
        write_wav(wav_to, mix)
        return Path(wav_to), total
    wav = scratch / f"{solo.id}.wav"
    write_wav(wav, mix)
    mp3 = out_dir / f"{solo.id}-{solo.title}.mp3"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-codec:a", "libmp3lame", "-b:a", "192k",
                    str(mp3)], check=True)
    return mp3, total


def main():
    # `compose.py --video-take OUT.wav`: solo 05 at 120 bpm (one bar = 2 s), uncapped, as a WAV — the soundtrack of the Remotion film
    # `neoclassic-solo` (assets/video/remotion), whose scenes are 2 s each.
    if len(sys.argv) == 3 and sys.argv[1] == "--video-take":
        with tempfile.TemporaryDirectory() as tmp:
            _, total = render(solo_05(bpm=120, tail=1.3, cap=99.0), HERE, Path(tmp), wav_to=Path(sys.argv[2]))
        print(f"{sys.argv[2]}  {total:.1f}s  120 bpm")
        return
    want = set(sys.argv[1:])
    with tempfile.TemporaryDirectory() as tmp:
        for make in SOLOS:
            solo = make()
            if want and solo.id not in want:
                continue
            mp3, total = render(solo, HERE, Path(tmp))
            line = " ".join(name(p) for _, _, p, _ in solo.lead)
            print(f"{mp3.name}  {total:.1f}s  {solo.bpm:g} bpm  {len(solo.lead)} lead notes\n   {line}")


if __name__ == "__main__":
    main()
