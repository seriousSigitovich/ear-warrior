# Guitar for the Silent Night lesson — GarageBand

Total length **1:50**. The file `out/silent-night-lesson.mid` has every note and strum, timed to the video.

## Setup

1. New project, **tempo 60 bpm**, 4/4. Drag in `silent-night-lesson.mid` (three tracks: Guitar, Chords, Hum). At 60 bpm, one beat is one second, so the DAW's timeline is the video's timecode.
2. Guitar track: an **acoustic guitar** software instrument, or play it yourself on the real guitar following the table below. The notes are on the high E string, **E4–E5**, so sit the part in the ringing range of the guitar (frets 0–12 of the first string).
3. Chords: play **open D and open Dm** yourself (same shapes as in the video) at the times below; the MIDI strums are only a guide. Keep the two strums equally loud and identical in picking, so the only difference is the one finger.
4. Hum: sing it yourself, softly, or give the track a voice/choir instrument and keep it low. It is only heard in the "bright or dark" step.
5. Leave room under speech: the voice-over goes on top. Keep the guitar around −20 dB and use a gentle room reverb.
6. **Export a WAV starting at 0:00 and exactly 1:50 long** (48 kHz or 44.1 kHz, 24-bit is fine). Then:

```bash
cd assets/video/lesson
node lesson.mjs video out --guitar /path/to/your-guitar.wav
```

The renderer swaps your recording in for the built-in guitar and keeps only the hum/chime cues from the synth if you do not record them (pass `--no-synth` to drop those too).

## Cue sheet (absolute time in the video)

| Time | Scene | What | Note / chord | Fret / strings | Length (s) |
|---|---|---|---|---|---|
| 0:00.4 | hook | guitar | A4 | fret 5 | 0.75 |
| 0:01.1 | hook | guitar | B4 | fret 7 | 0.25 |
| 0:01.4 | hook | guitar | A4 | fret 5 | 0.50 |
| 0:01.9 | hook | guitar | F#4 | fret 2 | 1.50 |
| 0:03.4 | hook | guitar | A4 | fret 5 | 0.75 |
| 0:04.2 | hook | guitar | B4 | fret 7 | 0.25 |
| 0:04.4 | hook | guitar | A4 | fret 5 | 0.50 |
| 0:04.9 | hook | guitar | F#4 | fret 2 | 2.06 |
| 0:12.2 | listen | guitar | A4 | fret 5 | 0.50 |
| 0:12.7 | listen | guitar | B4 | fret 7 | 0.17 |
| 0:12.9 | listen | guitar | A4 | fret 5 | 0.33 |
| 0:13.2 | listen | guitar | F#4 | fret 2 | 1.00 |
| 0:14.2 | listen | guitar | A4 | fret 5 | 0.50 |
| 0:14.7 | listen | guitar | B4 | fret 7 | 0.17 |
| 0:14.9 | listen | guitar | A4 | fret 5 | 0.33 |
| 0:15.2 | listen | guitar | F#4 | fret 2 | 1.00 |
| 0:16.2 | listen | guitar | E5 | fret 12 | 0.67 |
| 0:16.9 | listen | guitar | E5 | fret 12 | 0.33 |
| 0:17.2 | listen | guitar | C#5 | fret 9 | 1.00 |
| 0:18.2 | listen | guitar | D5 | fret 10 | 0.67 |
| 0:18.9 | listen | guitar | D5 | fret 10 | 0.33 |
| 0:19.2 | listen | guitar | A4 | fret 5 | 1.56 |
| 0:27.4 | home | hum | D4 | — | 2.40 |
| 0:30.4 | home | guitar | A4 | fret 5 | 0.48 |
| 0:31.0 | home | guitar | A#4 | fret 6 | 0.48 |
| 0:31.5 | home | guitar | B4 | fret 7 | 0.48 |
| 0:32.0 | home | guitar | C5 | fret 8 | 0.48 |
| 0:32.6 | home | guitar | C#5 | fret 9 | 0.48 |
| 0:33.1 | home | guitar | D5 | fret 10 | 3.36 |
| 0:40.2 | chords | chord | D | D3 A3 D4 F#4 | 1.60 |
| 0:41.8 | chords | chord | Dm | D3 A3 D4 F4 | 1.60 |
| 0:44.4 | chords | chord | D | D3 A3 D4 F#4 | 3.20 |
| 0:44.4 | chords | hum | A4 | — | 0.41 |
| 0:44.8 | chords | hum | B4 | — | 0.17 |
| 0:44.9 | chords | hum | A4 | — | 0.29 |
| 0:45.1 | chords | hum | F#4 | — | 0.79 |
| 0:45.9 | chords | hum | A4 | — | 0.41 |
| 0:46.3 | chords | hum | B4 | — | 0.17 |
| 0:46.4 | chords | hum | A4 | — | 0.29 |
| 0:46.6 | chords | hum | F#4 | — | 0.95 |
| 0:47.8 | chords | chord | Dm | D3 A3 D4 F4 | 3.20 |
| 0:47.8 | chords | hum | A4 | — | 0.41 |
| 0:48.2 | chords | hum | B4 | — | 0.17 |
| 0:48.3 | chords | hum | A4 | — | 0.29 |
| 0:48.5 | chords | hum | F#4 | — | 0.79 |
| 0:49.3 | chords | hum | A4 | — | 0.41 |
| 0:49.7 | chords | hum | B4 | — | 0.17 |
| 0:49.8 | chords | hum | A4 | — | 0.29 |
| 0:50.0 | chords | hum | F#4 | — | 0.95 |
| 0:57.0 | ladder | guitar | D5 | fret 10 | 0.44 |
| 0:57.5 | ladder | guitar | C#5 | fret 9 | 0.44 |
| 0:58.0 | ladder | guitar | B4 | fret 7 | 0.44 |
| 0:58.5 | ladder | guitar | A4 | fret 5 | 0.44 |
| 0:59.0 | ladder | guitar | G4 | fret 3 | 0.44 |
| 0:59.5 | ladder | guitar | F#4 | fret 2 | 0.44 |
| 1:00.0 | ladder | guitar | E4 | fret 0 | 0.44 |
| 1:00.7 | ladder | guitar | E5 | fret 12 | 0.76 |
| 1:17.2 | pick | guitar | A4 | fret 5 | 0.96 |
| 1:19.4 | pick | guitar | A#4 | fret 6 | 0.96 |
| 1:23.8 | pick | guitar | B4 | fret 7 | 0.96 |
| 1:25.4 | pick | guitar | A4 | fret 5 | 0.96 |
| 1:27.0 | pick | guitar | F#4 | fret 2 | 0.96 |
| 1:28.3 | pick | guitar | A4 | fret 5 | 0.50 |
| 1:28.8 | pick | guitar | B4 | fret 7 | 0.17 |
| 1:29.0 | pick | guitar | A4 | fret 5 | 0.33 |
| 1:29.3 | pick | guitar | F#4 | fret 2 | 1.56 |
| 1:30.5 | pick | guitar | E5 | fret 12 | 0.83 |
| 1:31.3 | pick | guitar | E5 | fret 12 | 0.42 |
| 1:31.8 | pick | guitar | C#5 | fret 9 | 1.81 |
| 1:33.4 | pick | guitar | C#5 | fret 9 | 0.66 |
| 1:34.2 | pick | guitar | D5 | fret 10 | 0.56 |
| 1:36.0 | pick | guitar | D5 | fret 10 | 0.83 |
| 1:36.8 | pick | guitar | D5 | fret 10 | 0.42 |
| 1:37.3 | pick | guitar | A4 | fret 5 | 1.81 |

Notes marked "fret 6" (A#4) in the "pick" scene are the deliberate wrong guess — play it, it must sound wrong.
