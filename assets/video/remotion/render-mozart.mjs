#!/usr/bin/env node
// The 10.5 s 3D Mozart cut (Eine kleine Nachtmusik):  node render-mozart.mjs  →  public/mozart-3d.wav + out/mozart-3d.mp4 (1080×1920, 120 fps)
// Timeline in mozart/story.mjs, picture in src/mozart/Mozart3D.tsx, soundtrack spring/audio.mjs on that timeline, narrator mozart/voice.mjs.
//   --cover  just the cover → out/mozart-3d-cover.{png,jpg}
//   --voice  first fetch the narrator lines from voice.ai
//   --audio-only        just the soundtrack            --still=<seconds>[,<seconds>…]   PNG frames → out/frames/
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finalizeLoudness } from './ten/audio.mjs';
import { renderBounceAudio } from './spring/audio.mjs';
import * as story from './mozart/story.mjs';
import { generateVoice, loadLines } from './mozart/voice.mjs';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'out'), { recursive: true });
const remotion = join(here, 'node_modules', '.bin', 'remotion');
const still = process.argv.find((a) => a.startsWith('--still='));
if (still) {
  mkdirSync(join(here, 'out', 'frames'), { recursive: true });
  for (const sec of still.slice(8).split(',').map(Number)) {
    const png = join(here, 'out', 'frames', `mozart_${sec}.png`);
    execFileSync(remotion, ['still', 'src/index.ts', 'Mozart3D', png, `--frame=${Math.round(sec * story.FPS)}`, '--log=error'], { cwd: here, stdio: 'inherit' });
    console.log(`mozart: → ${png}`);
  }
  process.exit(0);
}
if (process.argv.includes('--cover')) {                         // the cover: PNG + the JPEG Instagram takes
  const png = join(here, 'out', 'mozart-3d-cover.png'), jpg = png.replace(/png$/, 'jpg');
  execFileSync(remotion, ['still', 'src/index.ts', 'MozartCover', png, '--log=error'], { cwd: here, stdio: 'inherit' });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '2', jpg]);
  console.log(`mozart: → ${jpg}`);
  process.exit(0);
}
const wav = join(here, 'public', 'mozart-3d.wav');
if (process.argv.includes('--voice')) await generateVoice(process.argv.includes('--force'));
const voices = loadLines();
const { peak, measureText } = renderBounceAudio(wav, story, voices);
console.log(`mozart: ${voices.length} narrator lines${voices.length ? '' : ' (none — run with --voice)'}`);
const l = finalizeLoudness(wav, measureText);
console.log(`mozart: audio peak ${peak.toFixed(2)} → ${Number(l.input_i).toFixed(1)} LUFS in, normalised to −14 LUFS`);
if (process.argv.includes('--audio-only')) process.exit(0);
const mp4 = join(here, 'out', 'mozart-3d.mp4');
execFileSync(remotion, ['render', 'src/index.ts', 'Mozart3D', mp4, '--concurrency=8', '--log=error'], { cwd: here, stdio: 'inherit' });
console.log(`mozart: → ${mp4}`);
