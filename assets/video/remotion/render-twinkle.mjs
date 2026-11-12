#!/usr/bin/env node
// Tab Guy — ep. 4 "Twinkle" (27 s, 1080×1920, 60 fps):
//   node render-twinkle.mjs                voices (if missing) → public/twinkle.wav → out/twinkle.mp4
//   --audio-only  just the soundtrack      --still=<seconds>  one PNG frame → out/frames/
// Timeline in twinkle/story.mjs, picture in src/twinkle/TwinkleScene.tsx, sprites in public/twinkle/ (docs/tab-guy-ep4-script.md).
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FPS } from './twinkle/story.mjs';
import { generateVoice } from './twinkle/voice.mjs';
import { renderTwinkleAudio } from './twinkle/audio.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const name = 'twinkle', comp = 'TwinkleEp4';
mkdirSync(join(here, 'out', 'frames'), { recursive: true });
const still = process.argv.find((a) => a.startsWith('--still='));
if (!still) {
  await generateVoice();
  const { peak, voiced } = renderTwinkleAudio(join(here, 'public', `${name}.wav`));
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
