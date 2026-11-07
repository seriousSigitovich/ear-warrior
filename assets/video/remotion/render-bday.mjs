#!/usr/bin/env node
// Tab Guy, ep. 2 — "Happy Birthday" (the band at a birthday party, ≈ 24 s, 1080×1920, 60 fps):
//   node render-bday.mjs                voices (if missing) → public/bday.wav → out/bday.mp4
//   --audio-only  just the soundtrack      --still=<seconds>  one PNG frame → out/frames/
// Timeline in bday/story.mjs, picture in src/bday/BdayScene.tsx, sprites in public/band/ (cut by band/cut-sheet.py), voices by bday/voice.mjs.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FPS } from './bday/story.mjs';
import { generateVoice } from './bday/voice.mjs';
import { renderBdayAudio } from './bday/audio.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const name = 'bday', comp = 'BdayParty';
mkdirSync(join(here, 'out', 'frames'), { recursive: true });
const still = process.argv.find((a) => a.startsWith('--still='));
if (!still) {
  await generateVoice();
  const { peak, voiced } = renderBdayAudio(join(here, 'public', `${name}.wav`));
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
