"""The test riff: E-phrygian-flavoured gallop, four bars twice, lead enters on the repeat. 150 BPM, ~14 s.

Rhythm is written in beats; chugs are short single notes (the reader palm-mutes those) and stabs are open power chords.
"""
from .synth import Note

BPM = 150.0
E2, F2, G2, A2 = 40, 41, 43, 45


def _s(beats):
    return beats * 60.0 / BPM


def _chug(beat, pitch, length, vel=0.9):
    return [Note(_s(beat), min(_s(length) * 0.9, 0.18), pitch, vel)]


def _gallop(beat, pitch):
    return _chug(beat, pitch, 0.5, 0.95) + _chug(beat + 0.5, pitch, 0.25, 0.8) + _chug(beat + 0.75, pitch, 0.25, 0.85)


def _stab(beat, root, length, vel=1.0):
    return [Note(_s(beat), _s(length), p, vel) for p in (root, root + 7, root + 12)]


def _rhythm(o, final):
    n = []
    for b in (0, 1, 2):
        n += _gallop(o + b, E2)
    n += _chug(o + 3, E2, 0.5) + _stab(o + 3.5, E2, 0.5)
    for b in (4, 5, 6):
        n += _gallop(o + b, E2)
    n += _chug(o + 7, E2, 0.5) + _stab(o + 7.5, G2, 0.5)
    n += _gallop(o + 8, G2) + _gallop(o + 9, G2) + _gallop(o + 10, F2) + _gallop(o + 11, E2)
    n += _gallop(o + 12, E2) + _gallop(o + 13, E2) + _chug(o + 14, G2, 0.5) + _chug(o + 14.5, A2, 0.5)
    n += _stab(o + 15, E2, 3.0 if final else 1.0)
    return n


def _lead_note(beat, length, pitch, bend=()):
    return Note(_s(beat), _s(length), pitch, 0.9, bend=tuple((_s(b), s) for b, s in bend))


def _lead():
    L = _lead_note
    return [
        L(16, 2, 76, ((0, -2), (0.3, 0))),
        L(18, .5, 79), L(18.5, .5, 81), L(19, 1, 83, ((0, 0), (0.35, 1), (1.0, 1))),
        L(20, .5, 81), L(20.5, .5, 79), L(21, .5, 76), L(21.5, .5, 79),
        L(22, .5, 74), L(22.5, .5, 76), L(23, 1, 79, ((0, 0), (0.3, 2), (1.0, 2))),
        L(24, .75, 83), L(24.75, .25, 81), L(25, .5, 79), L(25.5, .5, 76), L(26, 1, 79, ((0, 0), (0.25, 2), (1.0, 2))),
        L(27, .5, 76), L(27.5, .5, 74),
        L(28, .5, 71), L(28.5, .5, 74), L(29, 1, 76),
        L(30, .5, 79), L(30.5, .5, 81), L(31, 3.5, 83),
    ]


def build():
    """(rhythm, lead, bpm) with note times in seconds."""
    return _rhythm(0, final=False) + _rhythm(16, final=True), _lead(), BPM
