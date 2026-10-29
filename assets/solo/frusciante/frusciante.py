"""3 Frusciante-style guitar solos, 20 s each: lyrical bends and singing vibrato, then legato flurries.

Run (from assets/solo/frusciante):
    ../../guitar-rig/.venv/bin/python frusciante.py         # all three
    ../../guitar-rig/.venv/bin/python frusciante.py 02      # one

Writes NN-name.mp3 (guitar + drums) and NN-name.mid (rhythm ch0 + lead ch2, GarageBand layout, no drums).
Rhythm guitar goes through the `crunch` preset, the lead through `lead`. Drums reuse the kit in ../beautiful/compose.py.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "beautiful"))

import compose as base                                       # noqa: E402  (also puts guitar-rig on sys.path)
from compose import Solo, arp, beat_list, bars, chug, chugs8, hats, name, roll, stab   # noqa: E402,F401
from guitar_rig.midi import Song, write_midi                 # noqa: E402
from guitar_rig.render import render_song, to_lufs           # noqa: E402
from guitar_rig.synth import SR, Note                        # noqa: E402

LENGTH = 20.0     # s, hard cap
VIB_MIN = 0.4     # s, same rule as guitar_rig.midi
LEAD_AMP = "metal"   # the preset that was approved by ear; `lead` and `crunch` are still unheard
RHYTHM_DB, LEAD_DB = -25.0, -19.0   # lead sits on top of the doubled rhythm, as a solo should


# ---- lead helpers (times in beats) ------------------------------------------
def L(beat, ln, pitch, *bend, vel=0.9):
    """One lead note. bend: (beat offset, semitones) points, e.g. (0, -2), (0.3, 0) = bent up into the pitch."""
    return (beat, ln, pitch, bend, vel)


def seq(beat, pitches, step, group=0, hi=0.96, lo=0.76):
    """A run of equal notes; the first of every `group` is picked hard, the rest are hammered/pulled (softer)."""
    return [L(beat + i * step, step, p, vel=hi if group and i % group == 0 else lo if group else 0.86)
            for i, p in enumerate(pitches)]


def lead_notes(lead, bpm):
    sp = 60.0 / bpm
    out = []
    for beat, ln, pitch, bend, vel in lead:
        dur = ln * sp * 0.96
        out.append(Note(beat * sp, dur, pitch, vel, vib=dur >= VIB_MIN, bend=tuple((b * sp, s) for b, s in bend)))
    return out


def rhythm_notes(notes, bpm):
    sp = 60.0 / bpm
    return [Note(x.start * sp, x.dur * sp, x.pitch, x.vel, x.mute, False, x.bend) for x in notes]


def pairs(beat, dyads, step):
    """Double-stops: (upper, lower) pitches sounding together."""
    return [L(beat + i * step, step, p, vel=0.88) for i, d in enumerate(dyads) for p in d]


def chord(beat, ln, pitches, vel=0.9):
    return [Note(beat, ln, p, vel) for p in pitches]


# ---- 01: D minor, "cathedral" -----------------------------------------------
def solo_01():
    """Dm Bb F C | Dm Bb A7 Dm, 100 bpm. Four bars of long bent notes, then three bars of shred, one held scream."""
    s = Solo("01", "d-minor-cathedral", 100, 32, "metal", tail=0.8, cap=LENGTH)
    s.lead = (
        # bars 1-4: sing. Bend-ins, wide leaps, vibrato on everything that holds
        [L(0, 2, 74, (0, -2), (0.35, 0)), L(2, .5, 77), L(2.5, 1.5, 81)]                        # D5 (from C5) F5 A5
        + [L(4, 1.5, 79), L(5.5, .5, 77), L(6, .5, 74), L(6.5, .5, 70), L(7, 1, 74)]            # G5 F5 D5 Bb4 D5
        + [L(8, 1.5, 72, (0, -2), (0.3, 0)), L(9.5, .5, 77), L(10, 2, 81)]                      # C5 (from Bb4) F5 A5
        + seq(12, [67, 72, 76, 79, 72, 76, 79, 84], .25, 4) + [L(14, 1.5, 84)]                  # C-major arpeggio up, C6
        # bars 5-7: shred. Falling pentatonic threes, rising fours over Bb, a Phrygian-dominant fall over A7
        + seq(16, [81, 79, 77, 79, 77, 74, 77, 74, 72, 74, 72, 69, 72, 69, 67, 69], .25, 3)
        + seq(20, [70, 72, 74, 77, 72, 74, 77, 79, 74, 77, 79, 82, 77, 79, 82, 84], .25, 4)
        + seq(24, [86, 85, 82, 81, 79, 77, 76, 74, 73, 70, 69, 67], .25, 4) + [L(27, 1, 73)]
        # bar 8: the scream, C6 bent up to D6
        + [L(28, 3.5, 86, (0, -2), (0.6, 0))]
    )
    am, f, g, c = [38, 50, 57, 62, 65], [46, 53, 58, 62, 65], [41, 48, 53, 57, 60], [48, 55, 60, 64, 67]
    s.rhythm = arp(0, 4, am) + arp(4, 4, f) + arp(8, 4, g) + arp(12, 4, c)
    for b0, root in [(16, 38), (20, 46), (24, 45)]:
        s.rhythm += stab(b0, 0.5, root) + chugs8(b0 + 0.5, b0 + 4, root)
    s.rhythm += chord(28, 4, [38, 45, 50, 53, 57], 0.95)
    s.drums = (
        [(0, "crash", 0.5)] + bars(0, 14, [0, 2.5], [2], 1, 0.3) + roll(14, 16, "snare", .25, .2, .85)
        + [(16, "crash", 0.85)] + bars(16, 27, [0, 1.5, 2, 3.5], [1, 3], .5, .4) + roll(27, 28, "tom_hi", .25, .5, .9)
        + [(28, "crash", 1.0), (28, "kick", 1.0), (28, "snare", .9), (30, "tom_low", .6), (31, "kick", .7)]
    )
    return s


# ---- 02: E minor, "firestorm" -----------------------------------------------
def solo_02():
    """Em C G D | Em C G D | Am B7 | Em, 128 bpm. Hendrix-ish call and answer, sextuplet bursts, descending thirds."""
    t = 1 / 6
    s = Solo("02", "e-minor-firestorm", 128, 40, "metal", tail=1.25, cap=LENGTH)
    s.lead = (
        # bars 1-2: the call. B5 bent from A5, a falling answer, then G5 bent from F#5 over C
        [L(0, 1, 83, (0, -2), (0.2, 0)), L(1, .5, 81), L(1.5, .5, 79), L(2, 1, 76), L(3, .5, 79), L(3.5, .5, 76)]
        + [L(4, 1.5, 79, (0, -1), (0.25, 0)), L(5.5, .5, 76), L(6, 1, 72), L(7, 1, 76, (0, -1), (0.2, 0))]
        # bars 3-4: sextuplet bursts over G, then a cascade down D major pentatonic
        + seq(8, [83, 86, 83, 81, 79, 81], t, 6) + seq(9, [83, 86, 83, 81, 79, 76], t, 6)
        + seq(10, [79, 83, 81, 79, 76, 79], t, 6) + [L(11, 1, 83)]
        + seq(12, [86, 83, 81, 78, 76, 74], t, 6) + seq(13, [83, 81, 78, 76, 74, 71], t, 6)
        + seq(14, [81, 78, 76, 74, 71, 69], t, 6) + [L(15, .5, 74), L(15.5, .5, 78)]
        # bars 5-6: D6 bent from C6, then an Em-pentatonic ladder, four notes at a time
        + [L(16, 2, 86, (0, -2), (0.3, 0)), L(18, .5, 83), L(18.5, .5, 81), L(19, 1, 79)]
        + seq(20, [71, 74, 76, 79, 74, 76, 79, 81, 76, 79, 81, 83, 79, 81, 83, 86], .25, 4)
        # bar 7: descending minor thirds over G, in eighths
        + pairs(24, [(86, 83), (83, 79), (81, 78), (79, 76), (78, 74), (76, 71), (74, 71), (71, 67)], .5)
        # bar 8: a rocket up D major pentatonic into the break
        + seq(28, [69, 71, 74, 76, 78, 81], t, 6) + seq(29, [74, 76, 78, 81, 83, 86], t, 6)
        + seq(30, [78, 81, 83, 86, 83, 81], t, 6) + [L(31, 1, 83)]
        # bar 9: breath. C6 over Am, then B5 F#5 D#5 over B7 (the D# is the whole point)
        + [L(32, 1, 84, (0, -2), (0.3, 0)), L(33, 1, 81), L(34, .5, 83), L(34.5, .5, 78), L(35, 1, 75, (0, -1), (0.3, 0))]
        # bar 10: home. E5, then B5 bent from A5, held until the end
        + [L(36, 1.5, 76), L(37.5, 2.5, 83, (0, -2), (0.4, 0))]
    )
    for b0, root in [(0, 40), (4, 48), (8, 43), (12, 50), (16, 40), (20, 48), (24, 43), (28, 50)]:
        if b0 < 16:
            s.rhythm += stab(b0, 1.5, root) + stab(b0 + 1.5, 1, root, 0.85) + stab(b0 + 2.5, 1.5, root, 0.9)
        else:
            s.rhythm += stab(b0, 0.5, root) + chugs8(b0 + 0.5, b0 + 4, root)
    s.rhythm += stab(32, 2, 45) + stab(34, 2, 47) + chord(36, 4, [40, 47, 52, 55, 59], 0.95)
    s.drums = (
        [(0, "crash", 0.7)] + bars(0, 8, [0, 2, 2.5], [1, 3], .5, .35)
        + [(8, "crash", .6)] + bars(8, 15, [0, 1.5, 2, 2.5], [1, 3], .5, .45) + roll(15, 16, "snare", .125, .3, .9)
        + [(16, "crash", .9)] + bars(16, 23, [0, 1, 2, 3], [1, 3], .5, .4) + roll(23, 24, "tom_mid", .25, .5, .9)
        + bars(24, 28, [0, 2], [1, 3], 1, .5) + [(24, "crash", .8)]
        + bars(28, 31, [0, 1, 2], [1, 3], .5, .45) + roll(31, 32, "snare", .125, .3, 1.0)
        + [(32, "crash", 1.0), (32, "kick", 1.0), (34, "snare", .8), (35, "tom_hi", .6), (35.5, "tom_low", .7),
           (36, "crash", 1.0), (36, "kick", 1.0), (36, "snare", .9), (38, "kick", .6)]
    )
    return s


# ---- 03: B minor, "sunburst" ------------------------------------------------
def solo_03():
    """Bm G D A | G A Bm, 88 bpm. A motif climbs a third per bar, then arpeggio sweeps, a chromatic fall, a long landing."""
    t = 1 / 6
    s = Solo("03", "b-minor-sunburst", 88, 28, "metal", tail=0.9, cap=LENGTH)
    s.lead = (
        # bars 1-3: the motif D5 F#5 B5(bent) A5 F#5, a third up over G, then released over D
        [L(0, .5, 74), L(.5, .5, 78), L(1, 1.5, 83, (0, -2), (0.3, 0)), L(2.5, .5, 81), L(3, 1, 78)]
        + [L(4, .5, 79), L(4.5, .5, 83), L(5, 1.5, 86, (0, -2), (0.3, 0)), L(6.5, .5, 83), L(7, 1, 79)]
        + [L(8, 1, 81), L(9, .5, 78), L(9.5, .5, 74), L(10, 1, 78), L(11, .5, 76), L(11.5, .5, 74)]
        # bar 4: A major arpeggio climbing in fours
        + seq(12, [69, 73, 76, 81, 73, 76, 81, 85, 76, 81, 85, 81, 85, 81, 76, 73], .25, 4)
        # bar 5: four sextuplet sweeps over G, down, up, down again, down
        + seq(16, [86, 83, 79, 74, 71, 67], t, 6) + seq(17, [67, 71, 74, 79, 83, 86], t, 6)
        + seq(18, [86, 83, 81, 79, 76, 74], t, 6) + seq(19, [83, 79, 76, 74, 71, 67], t, 6)
        # bar 6: C#6 falls chromatically over A, one semitone per sixteenth
        + seq(20, list(range(85, 73, -1)), .25, 4) + [L(23, 1, 73)]
        # bar 7: arpeggio up Bm, then D6 bent from C#6, held to the end
        + seq(24, [71, 74, 78, 83], .25, 4) + [L(25, 3, 86, (0, -1), (0.4, 0))]
    )
    bm, g, d, a = [47, 54, 59, 62, 66], [43, 50, 55, 59, 62], [38, 45, 50, 54, 57], [45, 52, 57, 61, 64]
    s.rhythm = arp(0, 4, bm) + arp(4, 4, g) + arp(8, 4, d) + arp(12, 4, a)
    for b0, root in [(16, 43), (20, 45)]:
        s.rhythm += stab(b0, 0.5, root) + chugs8(b0 + 0.5, b0 + 4, root)
    s.rhythm += chord(24, 4, [35, 47, 54, 59, 62, 66], 0.95)
    s.drums = (
        [(0, "crash", 0.45)] + bars(0, 8, [0], [], 1, .3) + beat_list([6], "snare", .5)
        + bars(8, 15, [0, 2, 2.5], [2], .5, .35) + roll(14.5, 16, "snare", .25, .25, .85)
        + [(16, "crash", .9)] + bars(16, 23, [0, .5, 2, 2.5], [1, 3], .5, .45) + roll(23, 24, "tom_hi", .25, .5, .9)
        + [(24, "crash", 1.0), (24, "kick", 1.0), (24, "snare", .9), (26, "tom_low", .6)]
    )
    return s


SOLOS = [solo_01, solo_02, solo_03]

# mix level over the piece, (beat, dB): the lyrical half sits back, the shred and the landing come forward
ARC = {
    "01": [(0, -5), (12, -3.5), (16, 0), (32, 0)],
    "02": [(0, -3), (16, -1), (24, 0), (32, 0), (34, -3), (36, 0), (40, 0)],
    "03": [(0, -5), (8, -4), (16, 0), (28, 0)],
}


def arc_for(solo, n_total):
    beats, db = zip(*ARC[solo.id])
    return 10 ** (np.interp(np.arange(n_total) / SR, np.array(beats) * 60 / solo.bpm, db) / 20)


# ---- render -----------------------------------------------------------------
def render(solo, out_dir, scratch):
    rhythm = rhythm_notes(solo.rhythm, solo.bpm)
    lead = lead_notes(solo.lead, solo.bpm)
    write_midi(out_dir / f"{solo.id}-{solo.title}.mid", rhythm, lead, solo.bpm)

    song = Song(tuple(rhythm), tuple(lead), solo.bpm)
    guitar = render_song(song, solo.amp, lead_amp=LEAD_AMP, takes=2, lufs=-18.0, rhythm_db=RHYTHM_DB, lead_db=LEAD_DB)
    total = min(solo.beats * 60 / solo.bpm + solo.tail, solo.cap)
    n_total = int(total * SR)
    guitar = guitar[:, :n_total] if guitar.shape[1] >= n_total else np.pad(guitar, ((0, 0), (0, n_total - guitar.shape[1])))

    # guitar only, for judging the tone without the synthetic kit
    solo_mix = guitar * arc_for(solo, n_total)
    solo_mix[:, -int(0.4 * SR):] *= np.linspace(1, 0, int(0.4 * SR))
    gwav = scratch / f"{solo.id}-g.wav"
    base.write_wav(gwav, to_lufs(solo_mix.astype(np.float32), SR, -14.0))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(gwav), "-codec:a", "libmp3lame", "-b:a", "192k",
                    str(out_dir / f"{solo.id}-{solo.title}-guitar-only.mp3")], check=True)

    drums = base.render_drums(solo.drums, solo.bpm, n_total)
    drums *= 10 ** ((-14.0 + base.DRUM_DB) / 20) / max(np.sqrt((drums ** 2).mean() * 4), 1e-9) * 0.5
    mix = ((guitar + drums) * arc_for(solo, n_total)).astype(np.float32)
    fade = int(0.4 * SR)
    mix[:, -fade:] *= np.linspace(1, 0, fade)
    mix = to_lufs(mix, SR, -14.0)

    wav = scratch / f"{solo.id}.wav"
    base.write_wav(wav, mix)
    mp3 = out_dir / f"{solo.id}-{solo.title}.mp3"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-codec:a", "libmp3lame", "-b:a", "192k",
                    str(mp3)], check=True)
    return mp3, total


def main():
    want = set(sys.argv[1:])
    with tempfile.TemporaryDirectory() as tmp:
        for make in SOLOS:
            solo = make()
            if want and solo.id not in want:
                continue
            mp3, total = render(solo, HERE, Path(tmp))
            line = " ".join(name(p) for _, _, p, _, _ in solo.lead)
            print(f"{mp3.name}  {total:.1f}s  {solo.bpm:g} bpm  {len(solo.lead)} lead notes\n   {line}")


if __name__ == "__main__":
    main()
