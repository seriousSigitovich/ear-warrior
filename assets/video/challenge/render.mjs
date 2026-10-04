// Renders challenge videos: slides.html frame-by-frame in headless Chrome, muxed with score.mjs's soundtrack.
//   node render.mjs stills <id> <outDir> 0,2.5,...   → PNG per timestamp (layout review)
//   node render.mjs video  <id|series|all> [outDir]  → 1080x1920 30 fps H.264 + AAC, ear-challenge-NN.mp4 (default ./out)
// Needs puppeteer-core (NODE_PATH) and the system Chrome + ffmpeg. Melodies come from challenges.json (generator,
// ids 1–7) and classics.mjs (famous tunes, ids 8+; `series` = all of those).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderScore } from './score.mjs';
import { timeline } from './timeline.mjs';
import { CLASSICS } from './classics.mjs';

// ESM ignores NODE_PATH; a CommonJS require honours it.
const puppeteer = createRequire(import.meta.url)('puppeteer-core');

const here = dirname(fileURLToPath(import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FPS = 30, W = 1080, H = 1920;
const challenges = JSON.parse(readFileSync(join(here, 'challenges.json'), 'utf8'));

const pool = [...challenges, ...CLASSICS];

const [mode, which, arg1, arg2] = process.argv.slice(2);
const pick = which === 'all' ? pool : which === 'series' ? CLASSICS : pool.filter(c => c.id === +which);
if (!['stills', 'video'].includes(mode) || !pick.length) {
  console.error('usage: render.mjs stills <id> <dir> t1,t2,... | video <id|series|all> [dir]');
  process.exit(1);
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb'] });

async function open(c) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(data => { window.CHALLENGE = data; }, { ...c, timeline: timeline(c) });
  page.on('pageerror', e => { throw e; });
  await page.goto(pathToFileURL(join(here, 'slides.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  return page;
}

if (mode === 'stills') {
  const [c] = pick;
  const dir = arg1;
  mkdirSync(dir, { recursive: true });
  const page = await open(c);
  for (const t of arg2.split(',').map(Number)) {
    await page.evaluate(t => window.renderAt(t), t);
    await page.screenshot({ path: join(dir, `c${c.id}_t${String(t).replace('.', '_')}.png`) });
  }
} else {
  const outDir = arg1 ?? join(here, 'out');
  mkdirSync(outDir, { recursive: true });
  for (const c of pick) {
    const { dur } = timeline(c);
    const work = mkdtempSync(join(tmpdir(), 'ew-challenge-'));
    const wav = join(work, 'score.wav');
    renderScore(c, wav);
    const target = join(outDir, `ear-challenge-${String(c.id).padStart(2, '0')}.mp4`);

    // Light room, loudness-normalize for social playback, fade out with the end card.
    const af = `aecho=0.8:0.6:60|110:0.25|0.18,loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=out:st=${dur - 1.2}:d=1.2,aformat=channel_layouts=stereo`;
    const ff = spawn('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-i', wav,
      '-af', af,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
      '-t', String(dur), '-movflags', '+faststart', target,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => { ff.on('close', code => (code === 0 ? res() : rej(new Error('ffmpeg exited ' + code)))); });

    const page = await open(c);
    const total = Math.round(FPS * dur);
    for (let f = 0; f < total; f++) {
      await page.evaluate(t => window.renderAt(t), f / FPS);
      const png = await page.screenshot({ type: 'png' });
      if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await done;
    await page.close();
    console.log('wrote', target);
  }
}
await browser.close();
