"""CLI: `python -m guitar_rig render riff.mid out.wav` and `python -m guitar_rig riff test-riff.mid`."""
import argparse
from pathlib import Path

from .amp import PRESETS
from .cab import load_ir
from .midi import read_midi, write_midi
from .render import render_song, write_wav
from .riff import build
from .synth import SR


def main(argv=None):
    p = argparse.ArgumentParser(prog="guitar_rig", description="MIDI → amped electric guitar, fully offline.")
    sub = p.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("render", help="render a MIDI file to a stereo WAV")
    r.add_argument("midi")
    r.add_argument("out")
    r.add_argument("--amp", choices=sorted(PRESETS), default="metal")
    r.add_argument("--takes", type=int, default=2, help="double-tracked rhythm takes, alternating L/R (default 2)")
    r.add_argument("--ir", help="cabinet impulse response WAV (default: built-in synthetic 4x12)")
    r.add_argument("--mute", choices=["auto", "off", "all"], default="auto",
                   help="palm mutes: auto = short low single notes (default)")
    r.add_argument("--lufs", type=float, default=-14.0, help="integrated loudness target (default -14)")
    r.add_argument("--seed", type=int, default=7)
    r.add_argument("--dry", action="store_true", help="skip amp and cabinet — the raw DI, for A/B")

    w = sub.add_parser("riff", help="write the built-in test riff as a MIDI file")
    w.add_argument("out")

    a = p.parse_args(argv)
    if a.cmd == "riff":
        rhythm, lead, bpm = build()
        write_midi(a.out, rhythm, lead, bpm)
        print(f"wrote {a.out}  ({len(rhythm)} rhythm + {len(lead)} lead notes, {bpm:g} BPM)")
        return

    song = read_midi(a.midi, mute=a.mute)
    ir = load_ir(a.ir, SR) if a.ir else None
    audio = render_song(song, a.amp, takes=a.takes, ir=ir, seed=a.seed, dry=a.dry, lufs=a.lufs)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    write_wav(a.out, audio)
    muted = sum(n.mute for n in song.rhythm)
    print(f"wrote {a.out}  {audio.shape[1] / SR:.1f}s  rhythm {len(song.rhythm)} ({muted} muted) lead {len(song.lead)} "
          f"@ {song.bpm:.0f} BPM, amp={'dry' if a.dry else a.amp}")


if __name__ == "__main__":
    main()
