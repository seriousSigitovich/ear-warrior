// Renders the Silent Night lesson: lesson.html frame by frame in headless Chrome, muxed with lesson-score.mjs's guitar track.
//   node lesson.mjs stills <dir> t1,t2,...   → PNG per timestamp (layout review)
//   node lesson.mjs video  [outDir] [--guitar my.wav [--no-synth]]
//                                            → 1920x1080 30 fps H.264 + AAC (guitar only — the voice-over is recorded on top), plus the
//                                              built-in guitar as WAV. --guitar swaps in the author's GarageBand export (see lesson-midi.mjs).
// Needs puppeteer-core (a devDependency of the app), the system Chrome and ffmpeg.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SCENES, DUR, FPS, W, H } from './script.mjs';
import { renderLesson } from './lesson-score.mjs';

const puppeteer = createRequire(import.meta.url)('puppeteer-core');
const here = dirname(fileURLToPath(import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); if (i < 0) return undefined; const v = argv[i + 1]; argv.splice(i, v && !v.startsWith('--') ? 2 : 1); return v && !v.startsWith('--') ? v : true; };
const GUITAR = flag('--guitar');     // the author's own recording (GarageBand export, starts at 0:00): replaces the built-in guitar
const NO_SYNTH = flag('--no-synth'); // with --guitar: also drop the built-in hum/chime cues
const [mode, arg1, arg2] = argv;
if (!['stills', 'video'].includes(mode)) { console.error('usage: lesson.mjs stills <dir> t1,t2,... | video [outDir]'); process.exit(1); }

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb'] });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.evaluateOnNewDocument(data => { window.LESSON = data; }, { scenes: SCENES, dur: DUR });
page.on('pageerror', e => { throw e; });
await page.goto(pathToFileURL(join(here, 'lesson.html')).href, { waitUntil: 'load' });
await page.evaluate(() => window.ready);

if (mode === 'stills') {
  mkdirSync(arg1, { recursive: true });
  for (const t of arg2.split(',').map(Number)) {
    await page.evaluate(t => window.renderAt(t), t);
    await page.screenshot({ path: join(arg1, `t${String(t).replace('.', '_')}.png`) });
  }
} else {
  const outDir = arg1 ?? join(here, 'out');
  mkdirSync(outDir, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), 'ew-lesson-'));
  const wav = join(work, 'guitar.wav');
  renderLesson(wav);
  copyFileSync(wav, join(outDir, 'silent-night-guitar.wav'));
  const target = join(outDir, 'silent-night-lesson.mp4');

  // Quiet bed for the narrator: loudness-normalised lower than the Shorts, with a short fade at the end.
  // With --guitar the author's recording is the bed (their reverb stays theirs); only the built-in hum/chime cues get the room effect.
  const tail = `loudnorm=I=-20:TP=-2:LRA=11,afade=t=out:st=${DUR - 1.2}:d=1.2,aformat=channel_layouts=stereo`;
  let audioIn, filter;
  if (GUITAR) {
    const cues = join(work, 'cues.wav');
    renderLesson(cues, ['note', 'chord']);
    audioIn = ['-i', GUITAR, ...(NO_SYNTH ? [] : ['-i', cues])];
    filter = NO_SYNTH ? `[1:a]${tail}[a]` : `[2:a]aecho=0.8:0.6:60|110:0.25|0.18,volume=0.5[h];[1:a][h]amix=inputs=2:duration=first:normalize=0,${tail}[a]`;
  } else {
    audioIn = ['-i', wav];
    filter = `[1:a]aecho=0.8:0.6:60|110:0.25|0.18,${tail}[a]`;
  }
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    ...audioIn, '-filter_complex', filter, '-map', '0:v', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
    '-t', String(DUR), '-movflags', '+faststart', target,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => { ff.on('close', code => (code === 0 ? res() : rej(new Error('ffmpeg exited ' + code)))); });

  const total = Math.round(FPS * DUR);
  for (let f = 0; f < total; f++) {
    await page.evaluate(t => window.renderAt(t), f / FPS);
    const jpg = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 300 === 0) console.log(`frame ${f}/${total}`);
  }
  ff.stdin.end();
  await done;
  console.log('wrote', target);
}
await browser.close();
