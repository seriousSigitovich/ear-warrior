#!/usr/bin/env node
// The 20 s neon cut of the challenge («Ну, погоди!» theme):  node render-neon.mjs  →  public/ten-neon.wav + out/ten-neon.mp4 (1080×1920, 60 fps)
// Timeline in neon/story.mjs, picture in src/neon/TenNeon.tsx, soundtrack laid by ten/audio.mjs from that timeline.
//   --audio-only        just the soundtrack            --still=<seconds>[,<seconds>…]   PNG frames → out/frames/
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTenAudio, finalizeLoudness } from './ten/audio.mjs';
import * as story from './neon/story.mjs';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'out'), { recursive: true });
const remotion = join(here, 'node_modules', '.bin', 'remotion');
const still = process.argv.find((a) => a.startsWith('--still='));
if (still) {
  mkdirSync(join(here, 'out', 'frames'), { recursive: true });
  for (const sec of still.slice(8).split(',').map(Number)) {
    const png = join(here, 'out', 'frames', `neon_${sec}.png`);
    execFileSync(remotion, ['still', 'src/index.ts', 'TenNeon', png, `--frame=${Math.round(sec * story.FPS)}`, '--log=error'], { cwd: here, stdio: 'inherit' });
    console.log(`neon: → ${png}`);
  }
  process.exit(0);
}
const wav = join(here, 'public', 'ten-neon.wav');
const { peak, measureText } = renderTenAudio(wav, story);
const l = finalizeLoudness(wav, measureText);
console.log(`neon: audio peak ${peak.toFixed(2)} → ${Number(l.input_i).toFixed(1)} LUFS in, normalised to −14 LUFS`);
if (process.argv.includes('--audio-only')) process.exit(0);
const mp4 = join(here, 'out', 'ten-neon.mp4');
execFileSync(remotion, ['render', 'src/index.ts', 'TenNeon', mp4, '--concurrency=8', '--log=error'], { cwd: here, stdio: 'inherit' });
console.log(`neon: → ${mp4}`);
