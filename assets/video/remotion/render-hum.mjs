#!/usr/bin/env node
// The 10 s "melody in my head" film:  node render-hum.mjs  →  public/hum-solo.wav + out/hum-solo.mp4 (1080×1920, 60 fps)
// Timeline in hum/story.mjs, picture in src/hum/HumVideo.tsx. The hum and room sounds are synthesized (hum/audio.mjs); the solo is
// assets/solo/06-a-harmonic-minor-neoclassic.mp3 laid on at SOLO_AT and trimmed to the end of the film.
//   --audio-only        just the soundtrack            --still=<seconds>   one PNG frame → out/frames/
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderHumAudio } from './hum/audio.mjs';
import { DURATION, FPS, SOLO_AT } from './hum/story.mjs';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'out'), { recursive: true });
const bed = join(here, 'out', 'hum-bed.wav');
const solo = join(here, '..', '..', 'solo', '06-a-harmonic-minor-neoclassic.mp3');
const peak = renderHumAudio(bed);
const runway = DURATION - SOLO_AT, ms = Math.round(SOLO_AT * 1000);
// the bed is mono; the solo is stereo. The solo's tail is faded out over the last 0.3 s of the film.
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', bed, '-i', solo, '-filter_complex',
  `[0:a]aformat=channel_layouts=stereo[b];[1:a]atrim=0:${runway},asetpts=PTS-STARTPTS,afade=t=out:st=${runway - 0.3}:d=0.3,volume=0.95,adelay=${ms}|${ms}[s];[b][s]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.95[o]`,
  '-map', '[o]', '-t', String(DURATION), '-ar', '44100', join(here, 'public', 'hum-solo.wav')], { stdio: 'inherit' });
console.log(`hum-solo: audio ready (hum peak ${peak.toFixed(2)})`);
if (process.argv.includes('--audio-only')) process.exit(0);

const remotion = join(here, 'node_modules', '.bin', 'remotion');
const still = process.argv.find((a) => a.startsWith('--still='));
if (still) {
  const sec = Number(still.slice(8));
  mkdirSync(join(here, 'out', 'frames'), { recursive: true });
  const png = join(here, 'out', 'frames', `hum-solo_${sec}.png`);
  execFileSync(remotion, ['still', 'src/index.ts', 'HumSolo', png, `--frame=${Math.round(sec * FPS)}`, '--log=error'], { cwd: here, stdio: 'inherit' });
  console.log(`hum-solo: → ${png}`);
  process.exit(0);
}
const mp4 = join(here, 'out', 'hum-solo.mp4');
execFileSync(remotion, ['render', 'src/index.ts', 'HumSolo', mp4, '--concurrency=8', '--log=error'], { cwd: here, stdio: 'inherit' });
console.log(`hum-solo: → ${mp4}`);
