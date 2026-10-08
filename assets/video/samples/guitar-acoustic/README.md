Single plucked notes of an acoustic guitar, used by the 12-fret video (kind "quiz", layout "string", id 18).

- Source: University of Iowa Electronic Music Studios, Musical Instrument Samples (guitar) — https://theremin.music.uiowa.edu/MISguitar.html. Free to use without restriction (their stated terms).
- Files are the per-note mp3s from the tonejs-instruments repo (MIT, https://github.com/nbrosowsky/tonejs-instruments, `samples/guitar-acoustic`), which re-cut the Iowa recordings: E4 F4 G4 A4 B4 C5 (3.4–4.7 s each, ~50 ms of leading silence).
- Only the notes the riff needs are kept; `guitarNote()` in ../../synth.mjs resamples the nearest file for any other pitch (≤ 2 semitones is fine).
