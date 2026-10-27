#!/usr/bin/env node
// The pixel-art guitarist films:
//   node render-warrior.mjs            5 s test cartoon  →  public/warrior-riff.wav + out/warrior-riff.mp4
//   node render-warrior.mjs --root     7 s "jam night — find the root" challenge  →  public/warrior-root.wav + out/warrior-root.mp4
// (1080×1920, 60 fps.) Timeline in warrior/story.mjs, picture in src/warrior/WarriorScene.tsx, sprites in public/warrior/ (cut from the character sheet).
//   node render-warrior.mjs --take=<audio file> [--chord=<sec>] [--bpm=120] [--t0=<sec>]   "find the key" cut from the author's own recording (GarageBand export):
//        finds the onsets → warrior/take.json, copies the audio → public/warrior-take.wav, renders out/warrior-key.mp4
//   --audio-only  just the soundtrack      --still=<seconds>  one PNG frame → out/frames/
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderWarriorAudio } from './warrior/audio.mjs';
import { FPS, RIFF, ROOT } from './warrior/story.mjs';
import { storyFromTake } from './warrior/take.mjs';
import { analyzeTake } from './warrior/analyze-take.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const root = process.argv.includes('--root'), take = arg('take');
const name = take ? 'warrior-key' : root ? 'warrior-root' : 'warrior-riff', comp = take ? 'WarriorKey' : root ? 'WarriorRoot' : 'WarriorRiff';
mkdirSync(join(here, 'out'), { recursive: true });
if (take) {
  const a = analyzeTake(take);
  const chord = arg('chord') === undefined ? undefined : Number(arg('chord'));
  const bpm = arg('bpm') === undefined ? undefined : Number(arg('bpm')), t0 = arg('t0') === undefined ? undefined : Number(arg('t0'));
  const opts = { ...(chord === undefined ? {} : { chord }), ...(bpm === undefined ? {} : { bpm }), ...(t0 === undefined ? {} : { t0 }) };
  writeFileSync(join(here, 'warrior', 'take.json'), JSON.stringify({ ...a, ...opts }));
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', take, '-ac', '2', '-ar', '44100', join(here, 'public', 'warrior-take.wav')]);
  const s = storyFromTake({ ...a, ...opts });
  console.log(`take: ${a.duration.toFixed(2)} s, ${a.onsets.length} onsets, chord at ${s.T.chord.toFixed(2)} s, film ${s.DURATION.toFixed(2)} s, ${s.CHUGS.filter((c) => c.big).length} big hits`);
} else {
  const peak = renderWarriorAudio(join(here, 'public', `${name}.wav`), root ? ROOT : RIFF);
  console.log(`${name}: audio peak ${peak.toFixed(2)}`);
}
if (process.argv.includes('--audio-only')) process.exit(0);
const remotion = join(here, 'node_modules', '.bin', 'remotion');
const still = process.argv.find((a) => a.startsWith('--still='));
if (still) {
  const sec = Number(still.slice(8));
  const png = join(here, 'out', 'frames', `${name}_${sec}.png`);
  mkdirSync(join(here, 'out', 'frames'), { recursive: true });
  execFileSync(remotion, ['still', 'src/index.ts', comp, png, `--frame=${Math.round(sec * FPS)}`, '--log=error'], { cwd: here, stdio: 'inherit' });
  console.log(`${name}: → ${png}`);
  process.exit(0);
}
const mp4 = join(here, 'out', `${name}.mp4`);
execFileSync(remotion, ['render', 'src/index.ts', comp, mp4, '--concurrency=8', '--log=error'], { cwd: here, stdio: 'inherit' });
console.log(`${name}: → ${mp4}`);
