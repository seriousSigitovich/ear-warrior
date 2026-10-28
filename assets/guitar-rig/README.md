# guitar-rig

Notes → amped electric guitar, fully offline and free. A MIDI file goes in, a stereo WAV comes out:

```
MIDI → string model (DI) → 4× oversampled tube-style preamp → noise gate → cabinet IR → double-track + delay → master → -14 LUFS
```

No samples and no downloads at run time. The pieces are [Pedalboard](https://github.com/spotify/pedalboard) (gate, EQ,
compressor, reverb, delay), scipy/numpy (string model, amp, cab) and mido (MIDI).

## Use

```bash
cd assets/guitar-rig
python3.13 -m venv .venv && .venv/bin/pip install -r requirements.txt     # once

.venv/bin/python -m guitar_rig riff riffs/test-riff.mid                    # write the built-in test riff
.venv/bin/python -m guitar_rig render riffs/test-riff.mid out/riff.wav     # → out/riff.wav (gitignored)
.venv/bin/python -m guitar_rig render ../solo/garage/01-chug-gallop-e.mid out/gallop.wav --amp crunch --takes 4
.venv/bin/python -m pytest -q
```

Options: `--amp metal|crunch`, `--takes N` (double-tracked rhythm, alternating L/R), `--ir cab.wav` (a real cabinet
IR instead of the built-in synthetic one), `--mute auto|off|all`, `--lufs -14`, `--dry` (raw DI, for A/B), `--seed`.

## MIDI conventions

Same as GarageBand's export: track "Guitar riff" (channel 0) is rhythm, "Bass" (channel 1) is skipped, "Lead"
(channel 2) is lead. Lead gets the delay, vibrato on notes ≥ 0.4 s, and pitch-wheel bends (±2 semitones).
There is no MIDI for palm mutes, so a short (≤ 0.22 s), low (≤ G3) single note is muted — a chug — while chords and
long notes ring.

## Tuning the tone

Everything audible is a number in `amp.py` (`PRESETS`) or `cab.py`. The levers, in the order they matter:
`Stage.gain` / `Stage.bias` (how much it saturates, how asymmetric), `in_hpf` and each stage's `hpf` (how tight the low
end is — raise them for a tighter chug, lower them for more thump), `boost_hz` / `boost_db` (the mid push), `fizz_lpf`,
the peaking filters in `cab_ir`. The presets were set from spectra, not by ear: expect to tune them.

## Next steps up

- **Real cabinets:** drop in any free IR WAV with `--ir`.
- **Neural Amp Modeler:** captured real amps. Its VST3 plugin loads in Pedalboard (`pedalboard.load_plugin`) in place of
  `preamp()`; its models are a free download, so that needs a decision on which source to trust.
- **Bass:** the "Bass" track is skipped; a bass voice would fill out the mix.
