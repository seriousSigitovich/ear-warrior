#!/usr/bin/env node
// The 20 s minimal Winter cut of the challenge (Vivaldi, Largo):  node render-winter.mjs  →  public/ten-winter.wav + out/ten-winter.mp4 (1080×1920, 60 fps)
// Timeline in winter/story.mjs, picture in src/winter/TenWinter.tsx, soundtrack laid by ten/audio.mjs from that timeline.
//   --cover  just the cover → out/ten-winter-cover.{png,jpg}
//   --voice  first fetch the narrator lines from voice.ai (winter/voice.mjs)
//   --audio-only        just the soundtrack            --still=<seconds>[,<seconds>…]   PNG frames → out/frames/
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTenAudio, finalizeLoudness } from './ten/audio.mjs';
import * as story from './winter/story.mjs';
import { generateVoice, loadLines } from './winter/voice.mjs';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'out'), { recursive: true });
const remotion = join(here, 'node_modules', '.bin', 'remotion');
const still = process.argv.find((a) => a.startsWith('--still='));
if (still) {
  mkdirSync(join(here, 'out', 'frames'), { recursive: true });
  for (const sec of still.slice(8).split(',').map(Number)) {
    const png = join(here, 'out', 'frames', `winter_${sec}.png`);
    execFileSync(remotion, ['still', 'src/index.ts', 'TenWinter', png, `--frame=${Math.round(sec * story.FPS)}`, '--log=error'], { cwd: here, stdio: 'inherit' });
    console.log(`winter: → ${png}`);
  }
  process.exit(0);
}
if (process.argv.includes('--cover')) {                         // the cover: PNG + the JPEG Instagram takes
  const png = join(here, 'out', 'ten-winter-cover.png'), jpg = png.replace(/png$/, 'jpg');
  execFileSync(remotion, ['still', 'src/index.ts', 'WinterCover', png, '--log=error'], { cwd: here, stdio: 'inherit' });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '2', jpg]);
  console.log(`winter: → ${jpg}`);
  process.exit(0);
}
const wav = join(here, 'public', 'ten-winter.wav');
if (process.argv.includes('--voice')) await generateVoice(process.argv.includes('--force'));
const voices = loadLines();
const { peak, measureText } = renderTenAudio(wav, story, voices);
console.log(`winter: ${voices.length} narrator lines${voices.length ? '' : ' (none — run with --voice)'}`);
const l = finalizeLoudness(wav, measureText);
console.log(`winter: audio peak ${peak.toFixed(2)} → ${Number(l.input_i).toFixed(1)} LUFS in, normalised to −14 LUFS`);
if (process.argv.includes('--audio-only')) process.exit(0);
const mp4 = join(here, 'out', 'ten-winter.mp4');
execFileSync(remotion, ['render', 'src/index.ts', 'TenWinter', mp4, '--concurrency=8', '--log=error'], { cwd: here, stdio: 'inherit' });
console.log(`winter: → ${mp4}`);
