"""Electric-guitar DI: an additive string model.

Each note is a stack of slightly inharmonic partials with a pick-position and pickup comb, per-partial decay
(highs die first, like a real string) and a short pick-noise burst. Bends and vibrato warp the phase, so they are
exact; palm mutes are the same string with a much faster decay. The output is a dry pickup signal — it only starts
to sound like a guitar after the amp and cabinet in `amp.py`.
"""
from __future__ import annotations

from dataclasses import dataclass, replace

import numpy as np

SR = 48_000
TAIL = 0.15          # s rendered after note-off: the string is damped by the hand
PARTIALS = 48
MAX_HZ = 16_000.0    # partials above this are dropped (also keeps bends under Nyquist)
INHARM = 8e-5        # string stiffness: partial k sits at k·f0·sqrt(1 + INHARM·k²)
PLUCK_POS, PICKUP_POS = 0.12, 0.15   # as a fraction of the string length
VIB_DELAY, VIB_RAMP, VIB_RATE, VIB_DEPTH = 0.22, 0.35, 5.6, 0.28   # s, s, Hz, semitones


@dataclass(frozen=True)
class Note:
    start: float                 # s
    dur: float                   # s
    pitch: float                 # MIDI
    vel: float = 0.8             # 0..1
    mute: bool = False           # palm mute
    vib: bool = False            # delayed vibrato
    bend: tuple[tuple[float, float], ...] = ()   # (seconds since note start, semitones), linear between points


def hz(midi):
    return 440.0 * 2.0 ** ((np.asarray(midi, dtype=float) - 69.0) / 12.0)


def humanize(notes, rng, jitter=0.002, strum=0.004, vel_spread=0.06):
    """Per-take feel: chords strummed low→high, a little timing and velocity drift. Note-offs stay put."""
    groups: dict[int, list[Note]] = {}
    for n in notes:
        groups.setdefault(round(n.start * 1000), []).append(n)
    out = []
    for key in sorted(groups):
        shift = rng.normal(0.0, jitter)
        for i, n in enumerate(sorted(groups[key], key=lambda n: n.pitch)):
            dt = max(shift + i * strum, -n.start)
            vel = float(np.clip(n.vel * (1 + rng.normal(0.0, vel_spread)), 0.2, 1.0))
            out.append(replace(n, start=n.start + dt, dur=max(0.03, n.dur - dt), vel=vel))
    return out


def _voice(note, sr, rng):
    f0 = float(hz(note.pitch))
    n = int((note.dur + TAIL) * sr)
    t = np.arange(n) / sr

    semis = np.zeros(n)
    if note.bend:
        bt, bs = zip(*note.bend)
        semis += np.interp(t, bt, bs)
    if note.vib:
        ramp = np.clip((t - VIB_DELAY) / VIB_RAMP, 0.0, 1.0)
        semis += VIB_DEPTH * ramp * np.sin(2 * np.pi * VIB_RATE * np.clip(t - VIB_DELAY, 0.0, None))
    warp = np.cumsum(2.0 ** (semis / 12.0)) / sr   # string time, stretched by bends and vibrato

    k = np.arange(1, max(1, min(PARTIALS, int(MAX_HZ / f0))) + 1)
    fk = f0 * k * np.sqrt(1 + INHARM * k * k)
    amp = np.abs(np.sin(np.pi * k * PLUCK_POS)) * np.abs(np.sin(np.pi * k * PICKUP_POS)) / k ** 0.8

    base = (0.30 + 0.008 * (note.pitch - 40)) * (14 if note.mute else 1)   # 1/s; lower strings ring longer
    tilt = 0.35 * (3 if note.mute else 1)                                  # highs decay faster
    rate = base * (1 + tilt * (k - 1) ** 1.2)

    y = np.zeros(n)
    phase0 = rng.uniform(0.0, 0.6, size=len(k))
    for i in range(len(k)):
        y += amp[i] * np.exp(-rate[i] * t) * np.sin(2 * np.pi * fk[i] * warp + phase0[i])
    y /= amp[:8].sum()

    m = min(n, int(0.008 * sr))
    pick = np.diff(rng.normal(size=m), prepend=0.0) * np.exp(-np.arange(m) / sr / 0.0018)
    y[:m] += (0.10 if note.mute else 0.06) * pick

    y *= 1 - np.exp(-t / 0.0012)
    y *= np.where(t > note.dur, np.exp(-(t - note.dur) / 0.02), 1.0)
    return y * (0.15 + 0.85 * note.vel ** 1.4)


def render_di(notes, sr=SR, seed=0, humanize_notes=True):
    """Mono float32 pickup signal for `notes` (seconds-based). Same seed → same take."""
    if not notes:
        raise ValueError("no notes to render")
    rng = np.random.default_rng(seed)
    ns = humanize(notes, rng) if humanize_notes else list(notes)
    out = np.zeros(int((max(n.start + n.dur for n in ns) + TAIL) * sr) + 8)
    for n in ns:
        v = _voice(n, sr, rng)
        i = int(round(n.start * sr))
        seg = out[i:i + len(v)]
        seg += v[:len(seg)]
    return out.astype(np.float32)
