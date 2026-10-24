// "The melody in my head" — 15 s. He hums the same climbing motif in a shower, on a bus and in a lift, can't sing the top note at night,
// gets the idea, and plays it as a solo (assets/solo/06-a-harmonic-minor-neoclassic.mp3 — the soundtrack of the last 6.4 s).
// One timeline for the soundtrack (audio.mjs) and every frame (src/hum/HumVideo.tsx), so each sound is heard when it is seen.
export const FPS = 60;
export const DURATION = 15;
export const BPM = 144;                    // the solo's tempo
export const BEAT = 60 / BPM;
export const SOLO_AT = 8.6;                // video second where the solo mp3 starts (its first beat is a crash); the solo fills the last 6.4 s

/** The 11 shots. No shot is longer than 1.8 s. */
export const SHOTS = [
  { id: 'shower', t0: 0.0, t1: 1.9 },
  { id: 'bus', t0: 1.9, t1: 3.7 },
  { id: 'lift', t0: 3.7, t1: 5.5 },
  { id: 'night', t0: 5.5, t1: 7.0 },
  { id: 'idea', t0: 7.0, t1: 8.6 },
  { id: 'wide', t0: 8.6, t1: 9.8 },
  { id: 'hand', t0: 9.8, t1: 11.0 },
  { id: 'low', t0: 11.0, t1: 12.2 },
  { id: 'side', t0: 12.2, t1: 13.2 },
  { id: 'eye', t0: 13.2, t1: 14.1 },
  { id: 'out', t0: 14.1, t1: 15.0 },
];
export const shotAt = (t) => SHOTS.find((s) => t >= s.t0 && t < s.t1) ?? SHOTS[SHOTS.length - 1];

/** What he hums: the first cells of the solo's climbing sequence, an octave down so a voice can reach them. Each cell is one step higher. */
const cell = (t0, midis, step = 0.36, dur = 0.34) => midis.map((midi, i) => ({ t: t0 + i * step, midi, dur }));
const shower = cell(0.12, [57, 60, 59, 62]);
shower[3].dur = 0.6;                         // trails off: he has lost the next note
const bus = cell(2.02, [59, 62, 60, 64]);
bus[3].dur = 0.5;
const lift = cell(3.82, [60, 64, 62, 65]);
lift[3].dur = 0.12;                          // breaks off on the top note…
export const HUM = [
  ...shower,                                // A C B D   — shower
  ...bus,                                   // B D C E   — bus
  ...lift,                                  // C E D F   — lift
  { t: 5.62, midi: 64, dur: 0.26 },         // night: reaches up…
  { t: 5.95, midi: 67, dur: 0.26 },
  { t: 6.28, midi: 71, dur: 0.26 },
  { t: 6.62, midi: 83, dur: 0.22, crack: true },   // …and the voice breaks
];

/** `stop` the lift hum breaks off, `ding` the doors; `crack` the voice breaks; `turn` the grandma starts to look; `bulb` the idea; `grab` he reaches for the guitar. */
export const T = { turn: 2.25, stop: 4.94, ding: 5.2, crack: 6.62, bulb: 7.5, grab: 7.95, whoosh: 8.3 };

/** The solo as played (same notes as lead_06 in assets/solo/solos.py). `fret` = fret on the high E string. */
const S = [69, 71, 72, 74, 76, 77, 80, 81, 83, 84, 86, 88];
const six = BEAT / 4;
export const SOLO = [];
for (let i = 0; i < 8; i++) [S[i], S[i + 2], S[i + 1], S[i + 3]].forEach((midi, j) => SOLO.push({ t: SOLO_AT + (i * 4 + j) * six, midi, dur: six }));
[8, 7, 6].forEach((j, k) => [S[j + 3], S[j + 1], S[j + 2], S[j]].forEach((midi, m) => SOLO.push({ t: SOLO_AT + (8 + k) * BEAT + m * six, midi, dur: six })));
for (let m = 0; m < 8; m++) SOLO.push({ t: SOLO_AT + 11 * BEAT + (m * BEAT) / 8, midi: 80, dur: BEAT / 8, trem: true });
export const FINAL = { t: SOLO_AT + 12 * BEAT, midi: 88, from: 81, slide: 0.3 * BEAT, dur: 2.5 * BEAT };
SOLO.push({ t: FINAL.t, midi: FINAL.midi, dur: FINAL.dur, final: true });
export const fret = (midi) => midi - 64;
