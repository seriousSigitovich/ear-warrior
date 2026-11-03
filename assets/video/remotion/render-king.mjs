#!/usr/bin/env node
// The 10.5 s Mountain King neon cut (#56's highway, no countdown, no answer):  node render-king.mjs  →  public/king-neon.wav + out/king-neon.mp4 (1080×1920, 60 fps)
//   --concurrency=<n>  fewer Chrome tabs when the page crashes for memory (default 8)
//   --tune=<id>  the same cut with a melody from king/tunes.mjs  →  public/king-<id>.wav + out/king-<id>.mp4
//   --cta=send   with --tune: the ending says "send this to a guitarist friend" instead of "comment the notes"  →  out/king-<id>-send.mp4
// Timeline in king/story.mjs, picture in src/king/KingNeon.tsx, soundtrack king/audio.mjs on that timeline.
//   --cover  a frame of the hook → out/king-neon-cover.{png,jpg}
//   --audio-only        just the soundtrack            --still=<seconds>[,<seconds>…]   PNG frames → out/frames/
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finalizeLoudness } from './ten/audio.mjs';
import { renderKingAudio } from './king/audio.mjs';
import * as KING from './king/story.mjs';
import { TUNES } from './king/tunes.mjs';

const COVER_AT = 1.1;                                           // the hook fully set, the hit's pillar still up

const tune = process.argv.find((a) => a.startsWith('--tune='))?.slice(7);
if (tune && !TUNES[tune]) throw new Error(`king: no tune '${tune}' (have ${Object.keys(TUNES).join(', ')})`);
const story = tune ? TUNES[tune] : KING;
const send = process.argv.includes('--cta=send');                // the ending asks to send it to a friend instead of commenting (H27)
if (send && !tune) throw new Error('king: --cta=send needs --tune=<id>');
const sound = tune ? `king-${tune}` : 'king-neon';
const comp = tune ? `King-${tune}${send ? '-send' : ''}` : 'KingNeon', name = `${sound}${send ? '-send' : ''}`;

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'out'), { recursive: true });
const remotion = join(here, 'node_modules', '.bin', 'remotion');
const still = process.argv.find((a) => a.startsWith('--still='));
if (still) {
  mkdirSync(join(here, 'out', 'frames'), { recursive: true });
  for (const sec of still.slice(8).split(',').map(Number)) {
    const png = join(here, 'out', 'frames', `${name}_${sec}.png`);
    execFileSync(remotion, ['still', 'src/index.ts', comp, png, `--frame=${Math.round(sec * story.FPS)}`, '--log=error'], { cwd: here, stdio: 'inherit' });
    console.log(`king: → ${png}`);
  }
  process.exit(0);
}
if (process.argv.includes('--cover')) {
  const png = join(here, 'out', `${name}-cover.png`), jpg = png.replace(/png$/, 'jpg');
  execFileSync(remotion, ['still', 'src/index.ts', comp, png, `--frame=${Math.round(COVER_AT * story.FPS)}`, '--log=error'], { cwd: here, stdio: 'inherit' });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '2', jpg]);
  console.log(`king: → ${jpg}`);
  process.exit(0);
}
const wav = join(here, 'public', `${sound}.wav`);
const { peak, measureText } = renderKingAudio(wav, story);
const l = finalizeLoudness(wav, measureText);
console.log(`king: audio peak ${peak.toFixed(2)} → ${Number(l.input_i).toFixed(1)} LUFS in, normalised to −14 LUFS`);
if (process.argv.includes('--audio-only')) process.exit(0);
const mp4 = join(here, 'out', `${name}.mp4`);
execFileSync(remotion, ['render', 'src/index.ts', comp, mp4, process.argv.find((a) => a.startsWith('--concurrency=')) ?? '--concurrency=8', '--log=error'], { cwd: here, stdio: 'inherit' });
console.log(`king: → ${mp4}`);
