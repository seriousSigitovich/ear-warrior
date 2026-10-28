"""Small filter helpers shared by the amp and the cabinet (scipy second-order sections)."""
import numpy as np
from scipy.signal import butter


def highpass(freq, sr, order=2):
    return butter(order, freq, btype="highpass", fs=sr, output="sos")


def lowpass(freq, sr, order=2):
    return butter(order, freq, btype="lowpass", fs=sr, output="sos")


def peaking(freq, gain_db, q, sr):
    """RBJ peaking EQ as a single SOS section."""
    a = 10 ** (gain_db / 40)
    w = 2 * np.pi * freq / sr
    alpha = np.sin(w) / (2 * q)
    cw = np.cos(w)
    b = np.array([1 + alpha * a, -2 * cw, 1 - alpha * a])
    den = np.array([1 + alpha / a, -2 * cw, 1 - alpha / a])
    return np.concatenate([b / den[0], den / den[0]])[None, :]
