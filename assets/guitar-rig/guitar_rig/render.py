"""Song → stereo mix: rhythm guitar double-tracked hard left/right, lead in the centre with a dotted-eighth delay."""
from __future__ import annotations

import numpy as np
import pyloudnorm as pyln
from pedalboard import Compressor, Delay, HighpassFilter, LowShelfFilter, Pedalboard, PeakFilter, Reverb
from pedalboard.io import AudioFile
from scipy.ndimage import minimum_filter1d, uniform_filter1d

from .amp import PRESETS, Amp, play_through
from .cab import cab_ir
from .midi import Song
from .synth import SR, render_di

RHYTHM_DB, LEAD_DB = -20.0, -21.0   # RMS of the loud parts of each stem, before the master chain
TAIL_SECONDS = 2.0


def level(x, target_db, sr=SR):
    """Scale `x` so its loud blocks (within 30 dB of the loudest) average `target_db` dBFS RMS."""
    blk = int(0.05 * sr)
    n = max(1, len(x) // blk) * blk
    p = (np.pad(x, (0, max(0, n - len(x))))[:n].reshape(-1, blk) ** 2).mean(axis=1)
    rms = np.sqrt(p[p > p.max() * 1e-3].mean())
    return x * (10 ** (target_db / 20) / max(rms, 1e-9))


def master(sr=SR):
    return Pedalboard([
        HighpassFilter(cutoff_frequency_hz=60),
        LowShelfFilter(cutoff_frequency_hz=110, gain_db=2.0, q=0.7),
        PeakFilter(cutoff_frequency_hz=420, gain_db=-2.5, q=0.9),
        Compressor(threshold_db=-18, ratio=2.5, attack_ms=8, release_ms=120),
        Reverb(room_size=0.18, damping=0.7, wet_level=0.08, dry_level=0.92, width=1.0),
    ])


def ceiling(audio, sr, db=-1.0, lookahead=0.005):
    """Brickwall limiter: gain dips ahead of every peak over `db` and recovers smoothly. No make-up gain
    (Pedalboard's Limiter adds some, which breaks a loudness target)."""
    c = 10 ** (db / 20)
    need = np.minimum(1.0, c / np.maximum(np.abs(audio).max(axis=0), 1e-9))
    size = 2 * int(lookahead * sr) + 1
    gain = uniform_filter1d(minimum_filter1d(need, size), size // 2 + 1)
    return (audio * gain).astype(np.float32)


def to_lufs(audio, sr, target):
    """Integrated loudness to `target` LUFS, then a -1 dBFS ceiling."""
    gain = 10 ** ((target - pyln.Meter(sr).integrated_loudness(audio.T)) / 20)
    return ceiling(audio * gain, sr)


def render_song(song: Song, amp: Amp | str = "metal", *, takes=2, ir=None, seed=7, sr=SR, dry=False, lufs=-14.0,
                lead_amp: Amp | str | None = None, rhythm_db=RHYTHM_DB, lead_db=LEAD_DB):
    """(2, n) float32 mix at `lufs`. `dry` skips amp and cabinet (raw DI) for A/B comparison. `lead_amp` gives the lead
    its own preset (default: the rhythm's); `rhythm_db`/`lead_db` set the stem levels before the master chain."""
    amp = PRESETS[amp] if isinstance(amp, str) else amp
    lead_amp = amp if lead_amp is None else PRESETS[lead_amp] if isinstance(lead_amp, str) else lead_amp
    ir = cab_ir(sr) if ir is None else ir

    def guitar(notes, take_seed, preset):
        di = render_di(list(notes), sr, take_seed)
        return di if dry else play_through(di, sr, preset, ir)

    rhythm = [level(guitar(song.rhythm, seed + i, amp), rhythm_db, sr) for i in range(takes)] if song.rhythm else []
    lead = level(guitar(song.lead, seed + 100, lead_amp), lead_db, sr) if song.lead else None

    n = max(len(x) for x in [*rhythm, *([lead] if lead is not None else [])]) + int(TAIL_SECONDS * sr)
    left, right = np.zeros(n), np.zeros(n)
    side = 1 / np.sqrt(max(1, takes // 2))
    for i, g in enumerate(rhythm):
        if takes == 1:
            left[:len(g)] += g * 0.7071
            right[:len(g)] += g * 0.7071
        else:
            (left if i % 2 == 0 else right)[:len(g)] += g * side
    if lead is not None:
        padded = np.pad(lead, (0, n - len(lead))).astype(np.float32)
        echo = Pedalboard([Delay(delay_seconds=0.75 * 60 / song.bpm, feedback=0.3, mix=0.2)])(padded, sr)
        left += echo * 0.7071
        right += echo * 0.7071
    stereo = np.stack([left, right]).astype(np.float32)
    return to_lufs(master(sr)(stereo, sr), sr, lufs)


def write_wav(path, audio, sr=SR):
    with AudioFile(str(path), "w", sr, audio.shape[0], bit_depth=24) as f:
        f.write(audio)
