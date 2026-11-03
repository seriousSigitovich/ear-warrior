#!/usr/bin/env node
// Tab Guy, ep. 1 — "Blues in A" (the band character sheet on a club stage, ≈ 24 s, 1080×1920, 60 fps):
//   node render-jam.mjs                 voices (if missing) → public/jam-blues.wav → out/jam-blues.mp4
//   --audio-only  just the soundtrack      --still=<seconds>  one PNG frame → out/frames/
// Timeline in jam/story.mjs, picture in src/jam/JamScene.tsx, sprites in public/band/ (cut by band/cut-sheet.py), voices by jam/voice.mjs.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FPS } from './jam/story.mjs';
import { generateVoice } from './jam/voice.mjs';
import { renderJamAudio } from './jam/audio.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const name = 'jam-blues', comp = 'JamBlues';
mkdirSync(join(here, 'out', 'frames'), { recursive: true });
const still = process.argv.find((a) => a.startsWith('--still='));
if (!still) {
  await generateVoice();
  const { peak, voiced } = renderJamAudio(join(here, 'public', `${name}.wav`));
  console.log(`${name}: audio peak ${peak.toFixed(2)}, ${voiced} voice lines`);
  if (process.argv.includes('--audio-only')) process.exit(0);
}
const remotion = join(here, 'node_modules', '.bin', 'remotion');
if (still) {
  const sec = Number(still.slice(8)), png = join(here, 'out', 'frames', `${name}_${sec}.png`);
  execFileSync(remotion, ['still', 'src/index.ts', comp, png, `--frame=${Math.round(sec * FPS)}`, '--log=error'], { cwd: here, stdio: 'inherit' });
  console.log(`${name}: → ${png}`);
  process.exit(0);
}
const mp4 = join(here, 'out', `${name}.mp4`);
execFileSync(remotion, ['render', 'src/index.ts', comp, mp4, '--concurrency=8', '--log=error'], { cwd: here, stdio: 'inherit' });
console.log(`${name}: → ${mp4}`);
