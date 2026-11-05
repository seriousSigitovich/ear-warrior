"""The disco loop's guitars through guitar-rig's `clean` amp: the 16th chop (chords + muted scratches) and the call phrase.

    ../../guitar-rig/.venv/bin/python groove/guitar.py <notes.json> <out-dir>

groove/audio.mjs writes notes.json from groove/story.mjs ({"chop": [...], "call": [...]}, each note {start, dur, pitch, vel, mute})
and mixes the two mono stems this writes (groove-chop.wav, groove-call.wav, 44.1 kHz) under its drums and bass.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from pedalboard import Compressor, Delay, Pedalboard
from pedalboard.io import AudioFile
from scipy.signal import resample_poly

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "guitar-rig"))
from guitar_rig.amp import PRESETS, play_through  # noqa: E402
from guitar_rig.cab import cab_ir  # noqa: E402
from guitar_rig.render import level  # noqa: E402
from guitar_rig.synth import SR, Note, render_di  # noqa: E402

OUT_SR = 44_100


def notes(raw, vib_from=None):
    return [Note(start=n["start"], dur=n["dur"], pitch=n["pitch"], vel=n["vel"], mute=n.get("mute", False),
                 vib=vib_from is not None and n["dur"] >= vib_from) for n in raw]


def stem(ns, fx, seed, db):
    ir = cab_ir(SR)
    y = play_through(render_di(ns, SR, seed), SR, PRESETS["clean"], ir)
    y = fx(y.astype(np.float32), SR)
    y = level(y, db, SR)
    return resample_poly(y, OUT_SR, SR).astype(np.float32)


def write(path, y):
    with AudioFile(str(path), "w", OUT_SR, 1, bit_depth=24) as f:
        f.write(y[np.newaxis, :])


def main(src, out_dir):
    data = json.loads(Path(src).read_text())
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    chop_fx = Pedalboard([Compressor(threshold_db=-20, ratio=4, attack_ms=2, release_ms=60)])
    write(out / "groove-chop.wav", stem(notes(data["chop"]), chop_fx, 11, -20.0))
    if data.get("call"):
        bpm = data["bpm"]
        lead_fx = Pedalboard([Compressor(threshold_db=-18, ratio=3, attack_ms=4, release_ms=90),
                              Delay(delay_seconds=0.75 * 60 / bpm, feedback=0.22, mix=0.16)])
        write(out / "groove-call.wav", stem(notes(data["call"], vib_from=0.4), lead_fx, 23, -18.0))


if __name__ == "__main__":
    main(*sys.argv[1:3])
