// Writes the lesson's guitar part as MIDI (for GarageBand etc.) plus a cue sheet to play along with.
//   node lesson-midi.mjs [outDir]  → <outDir>/silent-night-lesson.mid, ../../../docs/lesson-silent-night-guitar-cues.md
// The MIDI is timed in absolute seconds: the project tempo is 60 bpm, so one beat = one second and bar/beat positions in the DAW ARE
// the video's timecodes. No count-in, no pickup: 0:00 of the DAW = 0:00 of the video. Three tracks: Guitar (the string notes),
// Chords (D and Dm strums), Hum (the hummed tune over the chords; sing it yourself or give it a soft voice instrument).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENES, DUR } from './script.mjs';

const PPQ = 480;                       // at 60 bpm: 480 ticks = 1 s
const tick = s => Math.round(s * PPQ);
const vlq = n => { const b = [n & 127]; while ((n >>= 7)) b.unshift((n & 127) | 128); return b; };
const u32 = n => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const CHORDS = { D: [50, 57, 62, 66], Dm: [50, 57, 62, 65] }; // D3 A3 D4 F#4 / F4 — open shapes, low → high
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = m => NAMES[m % 12] + (Math.floor(m / 12) - 1);
const mmss = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

function track(name, program, events) {
  const ev = [];                       // [tick, order, bytes]; offs before ons at the same tick
  for (const e of events) {
    ev.push([tick(e.at), 1, [0x90, e.midi, e.vel ?? 96]], [tick(e.at + e.dur), 0, [0x80, e.midi, 0]]);
  }
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const n = [...Buffer.from(name)];
  const tr = [0, 0xff, 0x03, n.length, ...n, 0, 0xc0, program];
  let t = 0;
  for (const [tk, , bytes] of ev) { tr.push(...vlq(tk - t), ...bytes); t = tk; }
  tr.push(0, 0xff, 0x2f, 0);
  return [0x4d, 0x54, 0x72, 0x6b, ...u32(tr.length), ...tr];
}

const guitar = [], chords = [], hum = [], rows = [];
for (const s of SCENES) {
  for (const e of s.audio) {
    const at = s.start + e.at;
    if (e.kind === 'note') {
      const dur = Math.max(0.12, e.dur - 0.04);
      guitar.push({ at, midi: e.midi, dur, vel: 100 });
      rows.push([at, s.id, 'guitar', noteName(e.midi), `fret ${e.midi - 64}`, dur]);
    } else if (e.kind === 'hum') {
      hum.push({ at, midi: e.midi, dur: e.dur, vel: 80 });
      rows.push([at, s.id, 'hum', noteName(e.midi), '—', e.dur]);
    } else if (e.kind === 'chord') {
      CHORDS[e.name].forEach((m, k) => chords.push({ at: at + k * 0.035, midi: m, dur: e.dur, vel: e.gain ? 70 : 100 }));
      rows.push([at, s.id, 'chord', e.name, CHORDS[e.name].map(noteName).join(' '), e.dur]);
    }
  }
}
rows.sort((a, b) => a[0] - b[0]);

const us = 1_000_000; // 60 bpm
const head = [0x4d, 0x54, 0x68, 0x64, ...u32(6), 0, 1, 0, 4, PPQ >> 8, PPQ & 255];
const tempo = [0x4d, 0x54, 0x72, 0x6b, ...u32(11 + 8), 0, 0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255, 0, 0xff, 0x58, 4, 4, 2, 24, 8, 0, 0xff, 0x2f, 0];
const bytes = Buffer.from([...head, ...tempo, ...track('Guitar', 25, guitar), ...track('Chords', 25, chords), ...track('Hum', 53, hum)]);

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] ?? join(here, 'out');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'silent-night-lesson.mid'), bytes);

let md = `# Guitar for the Silent Night lesson — GarageBand\n\n`;
md += `Total length **${Math.floor(DUR / 60)}:${String(DUR % 60).padStart(2, '0')}**. The file \`out/silent-night-lesson.mid\` has every note and strum, timed to the video.\n\n`;
md += `## Setup\n\n1. New project, **tempo 60 bpm**, 4/4. Drag in \`silent-night-lesson.mid\` (three tracks: Guitar, Chords, Hum). At 60 bpm, one beat is one second, so the DAW's timeline is the video's timecode.\n`;
md += `2. Guitar track: an **acoustic guitar** software instrument, or play it yourself on the real guitar following the table below. The notes are on the high E string, **E4–E5**, so sit the part in the ringing range of the guitar (frets 0–12 of the first string).\n`;
md += `3. Chords: play **open D and open Dm** yourself (same shapes as in the video) at the times below; the MIDI strums are only a guide. Keep the two strums equally loud and identical in picking, so the only difference is the one finger.\n`;
md += `4. Hum: sing it yourself, softly, or give the track a voice/choir instrument and keep it low. It is only heard in the "bright or dark" step.\n`;
md += `5. Leave room under speech: the voice-over goes on top. Keep the guitar around −20 dB and use a gentle room reverb.\n`;
md += `6. **Export a WAV starting at 0:00 and exactly ${Math.floor(DUR / 60)}:${String(DUR % 60).padStart(2, '0')} long** (48 kHz or 44.1 kHz, 24-bit is fine). Then:\n\n`;
md += '```bash\ncd assets/video/lesson\nnode lesson.mjs video out --guitar /path/to/your-guitar.wav\n```\n\n';
md += `The renderer swaps your recording in for the built-in guitar and keeps only the hum/chime cues from the synth if you do not record them (pass \`--no-synth\` to drop those too).\n\n`;
md += `## Cue sheet (absolute time in the video)\n\n| Time | Scene | What | Note / chord | Fret / strings | Length (s) |\n|---|---|---|---|---|---|\n`;
for (const r of rows) md += `| ${mmss(r[0])} | ${r[1]} | ${r[2]} | ${r[3]} | ${r[4]} | ${r[5].toFixed(2)} |\n`;
md += `\nNotes marked "fret 6" (A#4) in the "pick" scene are the deliberate wrong guess — play it, it must sound wrong.\n`;
const root = join(here, '..', '..', '..');
writeFileSync(join(root, 'docs', 'lesson-silent-night-guitar-cues.md'), md);
console.log(`wrote ${join(outDir, 'silent-night-lesson.mid')}  (${guitar.length} guitar notes, ${chords.length / 4} strums, ${hum.length} hum notes) and the cue sheet`);
