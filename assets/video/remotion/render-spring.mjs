#!/usr/bin/env node
// The 10 s bouncing-ball Spring cut (Vivaldi, the theme):  node render-spring.mjs  →  public/spring-bounce.wav + out/spring-bounce.mp4 (1080×1920, 120 fps)
// Timeline in spring/story.mjs, picture in src/spring/SpringBounce.tsx, soundtrack in spring/audio.mjs, narrator in spring/voice.mjs.
//   --cover  just the cover → out/spring-bounce-cover.{png,jpg}
//   --voice  first fetch the narrator lines from voice.ai
//   --audio-only        just the soundtrack            --still=<seconds>[,<seconds>…]   PNG frames → out/frames/
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finalizeLoudness } from './ten/audio.mjs';
import { renderSpringAudio } from './spring/audio.mjs';
import { FPS } from './spring/story.mjs';
import { generateVoice, loadLines } from './spring/voice.mjs';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'out'), { recursive: true });
const remotion = join(here, 'node_modules', '.bin', 'remotion');
const still = process.argv.find((a) => a.startsWith('--still='));
if (still) {
  mkdirSync(join(here, 'out', 'frames'), { recursive: true });
  for (const sec of still.slice(8).split(',').map(Number)) {
    const png = join(here, 'out', 'frames', `spring_${sec}.png`);
    execFileSync(remotion, ['still', 'src/index.ts', 'SpringBounce', png, `--frame=${Math.round(sec * FPS)}`, '--log=error'], { cwd: here, stdio: 'inherit' });
    console.log(`spring: → ${png}`);
  }
  process.exit(0);
}
if (process.argv.includes('--cover')) {                         // the cover: PNG + the JPEG Instagram takes
  const png = join(here, 'out', 'spring-bounce-cover.png'), jpg = png.replace(/png$/, 'jpg');
  execFileSync(remotion, ['still', 'src/index.ts', 'SpringCover', png, '--log=error'], { cwd: here, stdio: 'inherit' });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '2', jpg]);
  console.log(`spring: → ${jpg}`);
  process.exit(0);
}
const wav = join(here, 'public', 'spring-bounce.wav');
if (process.argv.includes('--voice')) await generateVoice(process.argv.includes('--force'));
const voices = loadLines();
const { peak, measureText } = renderSpringAudio(wav, voices);
console.log(`spring: ${voices.length} narrator lines${voices.length ? '' : ' (none — run with --voice)'}`);
const l = finalizeLoudness(wav, measureText);
console.log(`spring: audio peak ${peak.toFixed(2)} → ${Number(l.input_i).toFixed(1)} LUFS in, normalised to −14 LUFS`);
if (process.argv.includes('--audio-only')) process.exit(0);
const mp4 = join(here, 'out', 'spring-bounce.mp4');
execFileSync(remotion, ['render', 'src/index.ts', 'SpringBounce', mp4, '--concurrency=8', '--log=error'], { cwd: here, stdio: 'inherit' });
console.log(`spring: → ${mp4}`);
