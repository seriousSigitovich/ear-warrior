"""Amp model: pre-EQ → cascaded asymmetric tanh gain stages (4× oversampled) → fizz filter → noise gate → cabinet.

Each stage is clip → coupling high-pass → low-pass, the way a tube preamp tightens up and rounds off between
stages. Asymmetric clipping (`bias`) adds even harmonics. Oversampling keeps the clipping harmonics from aliasing
back into the audible band.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from pedalboard import NoiseGate
from scipy.signal import fftconvolve, resample_poly, sosfilt

from .dsp import highpass, lowpass, peaking

OVERSAMPLE = 4


@dataclass(frozen=True)
class Stage:
    gain: float
    bias: float
    hpf: float   # Hz, coupling cap
    lpf: float   # Hz, interstage roll-off


@dataclass(frozen=True)
class Amp:
    name: str
    in_hpf: float        # tightens the low end before the first clipper
    boost_hz: float      # mid hump in front of the gain stages (the "tube screamer" push)
    boost_db: float
    stages: tuple[Stage, ...]
    fizz_lpf: float      # Hz, removes the top of the clipping harmonics
    gate_db: float       # noise gate threshold, dBFS, on the level-normalised amp output


PRESETS = {
    "metal": Amp("metal", 110, 850, 6.0,
                 (Stage(22, 0.50, 150, 8000), Stage(4, 0.25, 120, 7000), Stage(1.6, 0.10, 70, 9000)), 7500, -42),
    "crunch": Amp("crunch", 70, 1200, 3.0,
                  (Stage(7, 0.35, 100, 9000), Stage(2.2, 0.15, 70, 9000)), 8000, -55),
}


def preamp(di, sr, amp):
    up = sr * OVERSAMPLE
    x = resample_poly(di.astype(np.float64), OVERSAMPLE, 1)
    x = sosfilt(highpass(amp.in_hpf, up), x)
    x = sosfilt(peaking(amp.boost_hz, amp.boost_db, 0.8, up), x)
    for s in amp.stages:
        x = np.tanh(s.gain * x + s.bias) - np.tanh(s.bias)
        x = sosfilt(highpass(s.hpf, up), x)
        x = sosfilt(lowpass(s.lpf, up), x)
    x = sosfilt(lowpass(amp.fizz_lpf, up, 4), x)
    return resample_poly(x, 1, OVERSAMPLE)


def play_through(di, sr, amp, ir):
    """Mono DI → amp → gate → cabinet. `ir` is the cabinet impulse response (see cab.py)."""
    x = di / max(float(np.abs(di).max()), 1e-9) * 0.5
    y = preamp(x, sr, amp)
    y = y / max(float(np.abs(y).max()), 1e-9) * 0.9
    gate = NoiseGate(threshold_db=amp.gate_db, ratio=20, attack_ms=0.5, release_ms=50)
    y = gate(y.astype(np.float32), sr)
    return fftconvolve(y, ir)[: len(y)].astype(np.float32)
