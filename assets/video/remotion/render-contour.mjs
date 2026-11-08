#!/usr/bin/env node
// A tune drawn as a line of light (melody contour, no tab) in #71's wood-room look:  node render-contour.mjs [--tune=brahms]
//   → public/contour-<id>.wav + out/contour-<id>.mp4 (1080×1920, 60 fps). Picture src/contour/ContourLine.tsx, timeline + sound = king/tunes.mjs.
//   --cover  the whole contour under the hook → out/contour-<id>-cover.{png,jpg}
//   --audio-only  just the soundtrack            --still=<seconds>[,<seconds>…]  PNG frames → out/frames/
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finalizeLoudness } from './ten/audio.mjs';
import { renderKingAudio } from './king/audio.mjs';
import { TUNES } from './king/tunes.mjs';

const tune = process.argv.find((a) => a.startsWith('--tune='))?.slice(7) ?? 'brahms';
const story = TUNES[tune];
if (!story) throw new Error(`no tune "${tune}" in king/tunes.mjs`);
const name = `contour-${tune}`, comp = `Contour-${tune}`;          // name must match contourWav() in ContourLine.tsx

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'out', 'frames'), { recursive: true });
const remotion = join(here, 'node_modules', '.bin', 'remotion');
const still = process.argv.find((a) => a.startsWith('--still='));
if (still) {
  for (const sec of still.slice(8).split(',').map(Number)) {
    const png = join(here, 'out', 'frames', `${name}_${sec}.png`);
    execFileSync(remotion, ['still', 'src/index.ts', comp, png, `--frame=${Math.round(sec * story.FPS)}`, '--log=error'], { cwd: here, stdio: 'inherit' });
    console.log(`${name}: → ${png}`);
  }
  process.exit(0);
}
if (process.argv.includes('--cover')) {
  const png = join(here, 'out', `${name}-cover.png`), jpg = png.replace(/png$/, 'jpg');
  execFileSync(remotion, ['still', 'src/index.ts', `${comp}-cover`, png, '--frame=0', '--log=error'], { cwd: here, stdio: 'inherit' });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '2', jpg]);
  console.log(`${name}: → ${jpg}`);
  process.exit(0);
}
const wav = join(here, 'public', `${name}.wav`);
const { peak, measureText } = renderKingAudio(wav, story);
const l = finalizeLoudness(wav, measureText);
console.log(`${name}: audio peak ${peak.toFixed(2)} → ${Number(l.input_i).toFixed(1)} LUFS in, normalised to −14 LUFS`);
if (process.argv.includes('--audio-only')) process.exit(0);
const mp4 = join(here, 'out', `${name}.mp4`);
execFileSync(remotion, ['render', 'src/index.ts', comp, mp4, '--concurrency=8', '--log=error'], { cwd: here, stdio: 'inherit' });
console.log(`${name}: → ${mp4}`);
