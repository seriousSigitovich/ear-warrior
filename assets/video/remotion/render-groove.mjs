#!/usr/bin/env node
// The disco jam loop, two cuts on one 8 s groove:  node render-groove.mjs  →  public/groove-{jam,call}.wav + out/groove-{jam,call}.mp4
// (1080×1920, 60 fps, seamless loop). Timeline groove/story.mjs, picture src/groove/Groove.tsx, sound groove/audio.mjs (guitars via
// ../../guitar-rig, its `clean` amp — needs its .venv).
//   --only=jam|call      one cut            --audio-only      just the soundtracks
//   --still=<s>[,<s>…]   PNG frames of each cut → out/frames/groove-<cut>_<s>.png
//   --cover              a frame per cut → out/groove-<cut>-cover.{png,jpg}
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finalizeLoudness } from './ten/audio.mjs';
import { renderGrooveAudio } from './groove/audio.mjs';
import { FPS } from './groove/story.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const remotion = join(here, 'node_modules', '.bin', 'remotion');
const CUTS = { jam: { comp: 'GrooveJam', cover: 0.6 }, call: { comp: 'GrooveCall', cover: 0.95 } };
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
if (only && !CUTS[only]) throw new Error('--only takes jam|call');
const cuts = only ? [only] : Object.keys(CUTS);
mkdirSync(join(here, 'out', 'frames'), { recursive: true });
const still = (comp, png, sec) => execFileSync(remotion, ['still', 'src/index.ts', comp, png, `--frame=${Math.round(sec * FPS)}`, '--log=error'], { cwd: here, stdio: 'inherit' });

const stills = process.argv.find((a) => a.startsWith('--still='));
if (stills) {
  for (const cut of cuts) for (const sec of stills.slice(8).split(',').map(Number)) {
    const png = join(here, 'out', 'frames', `groove-${cut}_${sec}.png`);
    still(CUTS[cut].comp, png, sec);
    console.log(`groove-${cut}: → ${png}`);
  }
  process.exit(0);
}
if (process.argv.includes('--cover')) {
  for (const cut of cuts) {
    const png = join(here, 'out', `groove-${cut}-cover.png`), jpg = png.replace(/png$/, 'jpg');
    still(CUTS[cut].comp, png, CUTS[cut].cover);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '2', jpg]);
    console.log(`groove-${cut}: → ${jpg}`);
  }
  process.exit(0);
}
const paths = { jam: join(here, 'public', 'groove-jam.wav'), call: join(here, 'public', 'groove-call.wav') };
const res = renderGrooveAudio(paths, join(here, 'out', 'groove-rig'));
for (const cut of Object.keys(paths)) {
  const l = finalizeLoudness(res[cut].path, res[cut].measureText);
  console.log(`groove-${cut}: audio peak ${res[cut].peak.toFixed(2)} → ${Number(l.input_i).toFixed(1)} LUFS in, normalised to −14 LUFS`);
}
if (process.argv.includes('--audio-only')) process.exit(0);
for (const cut of cuts) {
  const mp4 = join(here, 'out', `groove-${cut}.mp4`);
  execFileSync(remotion, ['render', 'src/index.ts', CUTS[cut].comp, mp4, '--concurrency=8', '--log=error'], { cwd: here, stdio: 'inherit' });
  console.log(`groove-${cut}: → ${mp4}`);
}
