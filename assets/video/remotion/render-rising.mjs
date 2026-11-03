#!/usr/bin/env node
// House of the Rising Sun on #60's cut in the warm-wood look:  node render-rising.mjs  →  public/rising-wood.wav + out/rising-wood.mp4 (1080×1920, 60 fps)
// Timeline = king/tunes.mjs `rising`, picture in src/rising/RisingWood.tsx, soundtrack king/audio.mjs on that timeline.
//   --cover  a frame of the hook → out/rising-wood-cover.{png,jpg}
//   --audio-only        just the soundtrack            --still=<seconds>[,<seconds>…]   PNG frames → out/frames/
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finalizeLoudness } from './ten/audio.mjs';
import { renderKingAudio } from './king/audio.mjs';
import { TUNES } from './king/tunes.mjs';

const story = TUNES.rising;
const COVER_AT = 0.9;                                           // the hook fully set, the neck revealed

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'out'), { recursive: true });
const remotion = join(here, 'node_modules', '.bin', 'remotion');
const still = process.argv.find((a) => a.startsWith('--still='));
if (still) {
  mkdirSync(join(here, 'out', 'frames'), { recursive: true });
  for (const sec of still.slice(8).split(',').map(Number)) {
    const png = join(here, 'out', 'frames', `rising_${sec}.png`);
    execFileSync(remotion, ['still', 'src/index.ts', 'RisingWood', png, `--frame=${Math.round(sec * story.FPS)}`, '--log=error'], { cwd: here, stdio: 'inherit' });
    console.log(`rising: → ${png}`);
  }
  process.exit(0);
}
if (process.argv.includes('--cover')) {
  const png = join(here, 'out', 'rising-wood-cover.png'), jpg = png.replace(/png$/, 'jpg');
  execFileSync(remotion, ['still', 'src/index.ts', 'RisingWood', png, `--frame=${Math.round(COVER_AT * story.FPS)}`, '--log=error'], { cwd: here, stdio: 'inherit' });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '2', jpg]);
  console.log(`rising: → ${jpg}`);
  process.exit(0);
}
const wav = join(here, 'public', 'rising-wood.wav');
const { peak, measureText } = renderKingAudio(wav, story);
const l = finalizeLoudness(wav, measureText);
console.log(`rising: audio peak ${peak.toFixed(2)} → ${Number(l.input_i).toFixed(1)} LUFS in, normalised to −14 LUFS`);
if (process.argv.includes('--audio-only')) process.exit(0);
const mp4 = join(here, 'out', 'rising-wood.mp4');
execFileSync(remotion, ['render', 'src/index.ts', 'RisingWood', mp4, '--concurrency=8', '--log=error'], { cwd: here, stdio: 'inherit' });
console.log(`rising: → ${mp4}`);
