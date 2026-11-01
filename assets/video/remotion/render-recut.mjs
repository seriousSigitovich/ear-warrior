#!/usr/bin/env node
// The re-cut of #56 («Ну, погоди!», 3 s countdown, call to action over the answer, loops):  node render-recut.mjs  →  public/neon-recut.wav + out/neon-recut.mp4 (1080×1920, 60 fps)
// Timeline in recut/story.mjs, picture in src/recut/NeonRecut.tsx, soundtrack laid by ten/audio.mjs from that timeline.
//   --cover  a frame of the hook → out/neon-recut-cover.{png,jpg}
//   --audio-only        just the soundtrack            --still=<seconds>[,<seconds>…]   PNG frames → out/frames/
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTenAudio, finalizeLoudness } from './ten/audio.mjs';
import * as story from './recut/story.mjs';

const COVER_AT = 1.1;                                           // the hook fully set, the hit's pillar still up

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'out'), { recursive: true });
const remotion = join(here, 'node_modules', '.bin', 'remotion');
const still = process.argv.find((a) => a.startsWith('--still='));
if (still) {
  mkdirSync(join(here, 'out', 'frames'), { recursive: true });
  for (const sec of still.slice(8).split(',').map(Number)) {
    const png = join(here, 'out', 'frames', `recut_${sec}.png`);
    execFileSync(remotion, ['still', 'src/index.ts', 'NeonRecut', png, `--frame=${Math.round(sec * story.FPS)}`, '--log=error'], { cwd: here, stdio: 'inherit' });
    console.log(`recut: → ${png}`);
  }
  process.exit(0);
}
if (process.argv.includes('--cover')) {
  const png = join(here, 'out', 'neon-recut-cover.png'), jpg = png.replace(/png$/, 'jpg');
  execFileSync(remotion, ['still', 'src/index.ts', 'NeonRecut', png, `--frame=${Math.round(COVER_AT * story.FPS)}`, '--log=error'], { cwd: here, stdio: 'inherit' });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '2', jpg]);
  console.log(`recut: → ${jpg}`);
  process.exit(0);
}
const wav = join(here, 'public', 'neon-recut.wav');
const { peak, measureText } = renderTenAudio(wav, story);
const l = finalizeLoudness(wav, measureText);
// the last answer note is cut by the loop: a 60 ms fade so the cut into the hook's hit does not click
const tmp = wav + '.fade.wav';
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', wav, '-af', `afade=t=out:st=${(story.DURATION - 0.06).toFixed(3)}:d=0.06`, tmp]);
copyFileSync(tmp, wav); rmSync(tmp);
console.log(`recut: audio peak ${peak.toFixed(2)} → ${Number(l.input_i).toFixed(1)} LUFS in, normalised to −14 LUFS`);
if (process.argv.includes('--audio-only')) process.exit(0);
const mp4 = join(here, 'out', 'neon-recut.mp4');
execFileSync(remotion, ['render', 'src/index.ts', 'NeonRecut', mp4, '--concurrency=8', '--log=error'], { cwd: here, stdio: 'inherit' });
console.log(`recut: → ${mp4}`);
