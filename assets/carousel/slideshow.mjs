// Turns the exported carousel PNGs into a vertical slideshow video with Amazing Grace under it:
//   node slideshow.mjs [page=pentatonic]      -> out/<page>-slideshow.mp4 (1080×1920, H.264 + AAC, ~30 s)
// The tune is the first line of Amazing Grace (public domain, G major, same notes as challenge #21/#22 in
// assets/video/challenge/classics.mjs) on the recorded acoustic guitar, looped. The tempo is chosen so one loop is
// exactly as long as slides 1–4 together divided by two, which makes slide 5 (the tune in its box) start on a loop.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, track, guitarNote, writeWav } from '../video/synth.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const page = process.argv[2] ?? 'pentatonic';
const slidesDir = join(here, 'out', page);

// seconds per slide (the cover, three explaining slides, the tune, the tune list, the app)
const SLIDE_S = [3.5, 4, 4, 4, 7.75, 3.5, 3.5];
const LOOP_S = (SLIDE_S[0] + SLIDE_S[1] + SLIDE_S[2] + SLIDE_S[3]) / 2;   // 7.75 s
const TOTAL_S = SLIDE_S.reduce((a, b) => a + b, 0);

const NOTES = [['D4', 1], ['G4', 2], ['B4', 0.5], ['G4', 0.5], ['B4', 2], ['A4', 1], ['G4', 2], ['E4', 1], ['D4', 2]];  // note, beats
const MIDI = { D4: 62, E4: 64, G4: 67, A4: 69, B4: 71 };
const beats = NOTES.reduce((a, [, b]) => a + b, 0);                  // 12
const beat = LOOP_S / beats;                                         // ≈ 0.646 s ≈ 93 bpm

const t = track(TOTAL_S + 2);
for (let loop = 0; loop * LOOP_S < TOTAL_S; loop++) {
  let at = loop * LOOP_S;
  for (const [n, b] of NOTES) {
    t.mix(guitarNote(MIDI[n], b * beat, 0.2), at, 0.9);
    at += b * beat;
  }
}
mkdirSync(join(here, 'out'), { recursive: true });
const wav = join(here, 'out', `${page}-amazing-grace.wav`);
writeWav(wav, t.out);

const out = join(here, 'out', `${page}-slideshow.mp4`);
const imgs = SLIDE_S.flatMap((d, i) => ['-loop', '1', '-framerate', '30', '-t', String(d), '-i', join(slidesDir, `${String(i + 1).padStart(2, '0')}.png`)]);
const pads = SLIDE_S.map((_, i) => `[${i}:v]pad=1080:1920:0:285:color=0xf3f5fe,setsar=1[v${i}]`).join(';');
const concat = SLIDE_S.map((_, i) => `[v${i}]`).join('') + `concat=n=${SLIDE_S.length}:v=1:a=0[v]`;
const audio = `[${SLIDE_S.length}:a]aecho=0.8:0.55:70:0.22,afade=t=out:st=${(TOTAL_S - 1.8).toFixed(2)}:d=1.8,atrim=0:${TOTAL_S}[a]`;
execFileSync('ffmpeg', ['-y', '-v', 'error', ...imgs, '-i', wav, '-filter_complex', `${pads};${concat};${audio}`, '-map', '[v]', '-map', '[a]',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', '-crf', '18', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-t', String(TOTAL_S), out], { stdio: 'inherit' });
console.log(`${TOTAL_S} s, ${(60 / beat).toFixed(1)} bpm -> ${out}`);
