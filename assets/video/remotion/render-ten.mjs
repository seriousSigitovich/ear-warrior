#!/usr/bin/env node
// The 18 s "Can you play this by ear?" challenge:  node render-ten.mjs  →  public/ten-second.wav + out/ten-second.mp4 (1080×1920, 60 fps)
// Timeline in ten/story.mjs, picture in src/ten/TenSecond.tsx, soundtrack in ten/audio.mjs.
//   --audio-only        just the soundtrack            --still=<seconds>   one PNG frame → out/frames/
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTenAudio, finalizeLoudness } from './ten/audio.mjs';
import { FPS } from './ten/story.mjs';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'out'), { recursive: true });
const wav = join(here, 'public', 'ten-second.wav');
const { peak, measureText } = renderTenAudio(wav);
const l = finalizeLoudness(wav, measureText);
console.log(`ten: audio peak ${peak.toFixed(2)} → ${Number(l.input_i).toFixed(1)} LUFS in, normalised to −14 LUFS`);
if (process.argv.includes('--audio-only')) process.exit(0);
const remotion = join(here, 'node_modules', '.bin', 'remotion');
const still = process.argv.find((a) => a.startsWith('--still='));
if (still) {
  const sec = Number(still.slice(8));
  const png = join(here, 'out', 'frames', `ten_${sec}.png`);
  mkdirSync(join(here, 'out', 'frames'), { recursive: true });
  execFileSync(remotion, ['still', 'src/index.ts', 'TenSecond', png, `--frame=${Math.round(sec * FPS)}`, '--log=error'], { cwd: here, stdio: 'inherit' });
  console.log(`ten: → ${png}`);
  process.exit(0);
}
const mp4 = join(here, 'out', 'ten-second.mp4');
execFileSync(remotion, ['render', 'src/index.ts', 'TenSecond', mp4, '--concurrency=8', '--log=error'], { cwd: here, stdio: 'inherit' });
console.log(`ten: → ${mp4}`);
