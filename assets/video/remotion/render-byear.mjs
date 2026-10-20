#!/usr/bin/env node
// The 5 s "by ear" animation:  node render-byear.mjs  →  public/by-ear.wav + out/by-ear.mp4 (1080×1920, 60 fps)
// Timeline in by-ear/story.mjs, picture in src/byear/ByEar.tsx.   --audio-only for just the soundtrack;  --still=<seconds> for one PNG frame.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderByEarAudio } from './by-ear/audio.mjs';
import { FPS } from './by-ear/story.mjs';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'out'), { recursive: true });
const peak = renderByEarAudio(join(here, 'public', 'by-ear.wav'));
console.log(`by-ear: audio peak ${peak.toFixed(2)}`);
if (process.argv.includes('--audio-only')) process.exit(0);
const remotion = join(here, 'node_modules', '.bin', 'remotion');
const still = process.argv.find((a) => a.startsWith('--still='));
if (still) {
  const sec = Number(still.slice(8));
  const png = join(here, 'out', 'frames', `by-ear_${sec}.png`);
  mkdirSync(join(here, 'out', 'frames'), { recursive: true });
  execFileSync(remotion, ['still', 'src/index.ts', 'ByEar', png, `--frame=${Math.round(sec * FPS)}`, '--log=error'], { cwd: here, stdio: 'inherit' });
  console.log(`by-ear: → ${png}`);
  process.exit(0);
}
const mp4 = join(here, 'out', 'by-ear.mp4');
execFileSync(remotion, ['render', 'src/index.ts', 'ByEar', mp4, '--concurrency=8', '--log=error'], { cwd: here, stdio: 'inherit' });
console.log(`by-ear: → ${mp4}`);
