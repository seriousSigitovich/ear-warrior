#!/usr/bin/env node
// The 10.5 s Toccata minimal cut (#60's format in #57's look):  node render-toccata.mjs  →  public/toccata-minimal.wav + out/toccata-minimal.mp4 (1080×1920, 120 fps)
// Timeline in toccata/story.mjs, picture in src/toccata/ToccataMinimal.tsx, soundtrack king/audio.mjs on that timeline.
//   --cover  a frame of the hook → out/toccata-minimal-cover.{png,jpg}
//   --audio-only        just the soundtrack            --still=<seconds>[,<seconds>…]   PNG frames → out/frames/
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finalizeLoudness } from './ten/audio.mjs';
import { renderKingAudio } from './king/audio.mjs';
import * as story from './toccata/story.mjs';

const COVER_AT = 1.1;                                           // the hook fully set

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'out'), { recursive: true });
const remotion = join(here, 'node_modules', '.bin', 'remotion');
const still = process.argv.find((a) => a.startsWith('--still='));
if (still) {
  mkdirSync(join(here, 'out', 'frames'), { recursive: true });
  for (const sec of still.slice(8).split(',').map(Number)) {
    const png = join(here, 'out', 'frames', `toccata_${sec}.png`);
    execFileSync(remotion, ['still', 'src/index.ts', 'ToccataMinimal', png, `--frame=${Math.round(sec * story.FPS)}`, '--log=error'], { cwd: here, stdio: 'inherit' });
    console.log(`toccata: → ${png}`);
  }
  process.exit(0);
}
if (process.argv.includes('--cover')) {
  const png = join(here, 'out', 'toccata-minimal-cover.png'), jpg = png.replace(/png$/, 'jpg');
  execFileSync(remotion, ['still', 'src/index.ts', 'ToccataMinimal', png, `--frame=${Math.round(COVER_AT * story.FPS)}`, '--log=error'], { cwd: here, stdio: 'inherit' });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '2', jpg]);
  console.log(`toccata: → ${jpg}`);
  process.exit(0);
}
const wav = join(here, 'public', 'toccata-minimal.wav');
const { peak, measureText } = renderKingAudio(wav, story);
const l = finalizeLoudness(wav, measureText);
console.log(`toccata: audio peak ${peak.toFixed(2)} → ${Number(l.input_i).toFixed(1)} LUFS in, normalised to −14 LUFS`);
if (process.argv.includes('--audio-only')) process.exit(0);
const mp4 = join(here, 'out', 'toccata-minimal.mp4');
execFileSync(remotion, ['render', 'src/index.ts', 'ToccataMinimal', mp4, '--concurrency=8', '--log=error'], { cwd: here, stdio: 'inherit' });
console.log(`toccata: → ${mp4}`);
