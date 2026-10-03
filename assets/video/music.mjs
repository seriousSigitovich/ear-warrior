// Synthesizes the promo soundtrack to a mono WAV — no samples, same spirit as the app's runtime audio.
// The plucked-string voice mirrors renderPluckedString() in src/services/audio/synth.ts (Karplus–Strong).
// Usage: node music.mjs out.wav
//
// Timeline is on a 0.5 s grid (120 BPM) and must stay in step with slides.html:
//   0–4 hook · 4–8 problem · 8–12 call (S3) · 12–20 call → reply → result (S4) · 20–24 instruments · 24–30 close
import { track, pluck, voice, keys, bell, pad, sub, writeWav } from './synth.mjs';

const DUR = 30;
const { out, mix } = track(DUR);

// --- score ------------------------------------------------------------------------------------

// Chord bed: [startSec, durSec, bassMidi, padMidis]. Am | F | C | G | Am | F | C | G | Am
const Am = [45, [57, 60, 64]], F = [41, [53, 57, 60]], C = [48, [55, 60, 64]], G = [43, [55, 59, 62]];
const chords = [[0, 4, Am], [4, 4, F], [8, 4, C], [12, 4, G], [16, 4, Am], [20, 2, F], [22, 2, C], [24, 2, G], [26, 4, Am]];
for (const [t, d, [bass, notes]] of chords) {
  mix(pad(notes, d + 0.7), t, 0.075);
  mix(sub(bass, d), t, 0.2);
}

// S1 + S2: sparse, slightly unresolved melody.
[[0.0, 64], [1.0, 69], [2.0, 67], [3.0, 64], [4.5, 69], [5.5, 72], [6.5, 69], [7.5, 67]]
  .forEach(([t, m]) => mix(pluck(m, 2.2), t, 0.5));

// Melody the viewer is asked to reproduce (E3 G3 A3 C4 A3), then the hummed reply with one wrong note (F3).
const TARGET = [52, 55, 57, 60, 57];
const REPLY = [52, 53, 57, 60, 57];
TARGET.forEach((m, i) => mix(pluck(m, i === 4 ? 2.4 : 1.4, 0x1234567 + i), 8.5 + i * 0.5, 0.75));   // S3 call
TARGET.forEach((m, i) => mix(pluck(m, i === 4 ? 2.4 : 1.4, 0x7654321 + i), 12.5 + i * 0.5, 0.75)); // S4 call
REPLY.forEach((m, i) => mix(voice(m, i === 4 ? 1.8 : 0.9), 15.0 + i * 0.5, 0.3));                  // S4 reply

// S4 result chime (Am arpeggio of bells) — "it landed".
[69, 72, 76].forEach((m, i) => mix(bell(m, 2.2), 17.5 + i * 0.09, 0.3));

// S5: three timbres, one per word.
mix(pluck(57, 2.0), 20.5, 0.8);                                   // Guitar
[60, 64].forEach(m => mix(keys(m + 12, 2.0), 21.5, 0.38));         // Piano (open third)
mix(voice(67, 1.9), 22.5, 0.55);                                  // Voice

// S6: logo bell, then a rising Am arpeggio as the tagline lands.
mix(bell(74, 2.5), 24.4, 0.22);
[57, 60, 64, 69].forEach((m, i) => mix(pluck(m, 2.4, 0xabc + i), 26.0 + i * 0.5, 0.7));
mix(bell(81, 3.0), 28.0, 0.18);

// --- master -----------------------------------------------------------------------------------
const peak = writeWav(process.argv[2] ?? 'music.wav', out);
console.log(`wrote ${process.argv[2] ?? 'music.wav'} (${DUR}s, pre-master peak ${peak.toFixed(2)})`);
