// Renders slides.html frame-by-frame with headless Chrome and muxes it with the synthesized soundtrack.
//   node render.mjs stills <outDir> 1,5.5,9.5,...    → PNG per timestamp (layout review)
//   node render.mjs video  <out.mp4>                 → full 1080x1920 30 fps H.264 + AAC
// Needs puppeteer-core (NODE_PATH) and the system Chrome + ffmpeg. Soundtrack comes from music.mjs.
import puppeteer from 'puppeteer-core';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FPS = 30, DUR = 30, W = 1080, H = 1920;

const [mode, target, arg] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb'] });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(here, 'slides.html')).href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);

if (mode === 'stills') {
  mkdirSync(target, { recursive: true });
  for (const t of arg.split(',').map(Number)) {
    await page.evaluate(t => window.renderAt(t), t);
    await page.screenshot({ path: join(target, `t${String(t).replace('.', '_')}.png`) });
  }
  await browser.close();
} else if (mode === 'video') {
  const work = mkdtempSync(join(tmpdir(), 'ew-promo-'));
  const wav = join(work, 'music.wav');
  execFileSync('node', [join(here, 'music.mjs'), wav], { stdio: 'inherit' });

  // Light room, loudness-normalize for social playback, fade out with the closing card.
  const af = `aecho=0.8:0.6:60|110:0.25|0.18,loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=out:st=${DUR - 1.6}:d=1.6,aformat=channel_layouts=stereo`;
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-i', wav,
    '-af', af,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
    '-t', String(DUR), '-movflags', '+faststart', target,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => { ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))); });

  const total = FPS * DUR;
  for (let f = 0; f < total; f++) {
    await page.evaluate(t => window.renderAt(t), f / FPS);
    const png = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 90 === 0) console.log(`frame ${f}/${total}`);
  }
  ff.stdin.end();
  await done;
  await browser.close();
  console.log('wrote', target);
} else {
  console.error('usage: render.mjs stills <dir> t1,t2,... | video <out.mp4>');
  process.exit(1);
}
