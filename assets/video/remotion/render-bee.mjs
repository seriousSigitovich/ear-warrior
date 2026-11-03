#!/usr/bin/env node
// #69, the 6.5 s Bumblebee minimal cut (#62's format, #68's tune):  node render-bee.mjs  →  public/bee-minimal.wav + out/bee-minimal.mp4 (1080×1920, 120 fps)
// Timeline in bee/story.mjs, picture in src/bee/BeeMinimal.tsx, soundtrack king/audio.mjs on that timeline.
//   --cover  a frame of the hook → out/bee-minimal-cover.{png,jpg}
//   --audio-only        just the soundtrack            --still=<seconds>[,<seconds>…]   PNG frames → out/frames/
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finalizeLoudness } from './ten/audio.mjs';
import { renderKingAudio } from './king/audio.mjs';
import * as story from './bee/story.mjs';

const COVER_AT = 0.5;                                           // the hook fully set, before the first note

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'out'), { recursive: true });
const remotion = join(here, 'node_modules', '.bin', 'remotion');
const still = process.argv.find((a) => a.startsWith('--still='));
if (still) {
  mkdirSync(join(here, 'out', 'frames'), { recursive: true });
  for (const sec of still.slice(8).split(',').map(Number)) {
    const png = join(here, 'out', 'frames', `bee_${sec}.png`);
    execFileSync(remotion, ['still', 'src/index.ts', 'BeeMinimal', png, `--frame=${Math.round(sec * story.FPS)}`, '--log=error'], { cwd: here, stdio: 'inherit' });
    console.log(`bee: → ${png}`);
  }
  process.exit(0);
}
if (process.argv.includes('--cover')) {
  const png = join(here, 'out', 'bee-minimal-cover.png'), jpg = png.replace(/png$/, 'jpg');
  execFileSync(remotion, ['still', 'src/index.ts', 'BeeMinimal', png, `--frame=${Math.round(COVER_AT * story.FPS)}`, '--log=error'], { cwd: here, stdio: 'inherit' });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '2', jpg]);
  console.log(`bee: → ${jpg}`);
  process.exit(0);
}
const wav = join(here, 'public', 'bee-minimal.wav');
const { peak, measureText } = renderKingAudio(wav, story);
const l = finalizeLoudness(wav, measureText);
console.log(`bee: audio peak ${peak.toFixed(2)} → ${Number(l.input_i).toFixed(1)} LUFS in, normalised to −14 LUFS`);
if (process.argv.includes('--audio-only')) process.exit(0);
const mp4 = join(here, 'out', 'bee-minimal.mp4');
execFileSync(remotion, ['render', 'src/index.ts', 'BeeMinimal', mp4, '--concurrency=4', '--log=error'], { cwd: here, stdio: 'inherit' });
console.log(`bee: → ${mp4}`);
