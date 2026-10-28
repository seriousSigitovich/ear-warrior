"""Guitar cabinet impulse responses.

`cab_ir` builds a synthetic closed-back 4×12: low resonance, box-mid dip, upper-mid bite, a presence peak, the steep
speaker roll-off near 5 kHz and a faint mic comb. A real IR (any WAV) can replace it with `load_ir`.
"""
import numpy as np
from math import gcd
from scipy.signal import resample_poly, sosfilt

from .dsp import highpass, lowpass, peaking


def cab_ir(sr, length=2048):
    sos = np.vstack([
        highpass(80, sr, 2),
        peaking(115, 4.0, 1.4, sr),
        peaking(330, -3.5, 1.0, sr),
        peaking(1800, 3.0, 1.1, sr),
        peaking(3200, 5.0, 1.5, sr),
        lowpass(5200, sr, 4),
        lowpass(7500, sr, 2),
    ])
    impulse = np.zeros(length)
    impulse[0] = 1.0
    ir = sosfilt(sos, impulse)
    comb = int(round(0.00023 * sr))   # mic a few centimetres off-axis
    ir[comb:] += 0.3 * ir[:-comb].copy()
    ir *= np.concatenate([np.ones(length * 3 // 4), np.hanning(length // 2)[length // 4:]])
    return ir / np.sqrt(np.sum(ir ** 2))


def load_ir(path, sr):
    """Mono-mix a WAV impulse response, resample to `sr`, normalise its energy."""
    from pedalboard.io import AudioFile

    with AudioFile(str(path)) as f:
        data = f.read(f.frames).mean(axis=0).astype(np.float64)
        src = int(f.samplerate)
    if src != sr:
        g = gcd(src, sr)
        data = resample_poly(data, sr // g, src // g)
    return data / np.sqrt(np.sum(data ** 2))
