// Exports the carousel slides to 1080×1350 PNGs: node export.mjs [page=pentatonic] [outDir=out/<page>]
// Needs puppeteer-core (a devDependency of the app) and the system Chrome, like assets/video/challenge/render.mjs.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const puppeteer = createRequire(import.meta.url)('puppeteer-core');
const page = process.argv[2] ?? 'pentatonic';
const out = join(here, process.argv[3] ?? join('out', page));
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb'] });
const tab = await browser.newPage();
await tab.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
await tab.goto(pathToFileURL(join(here, `${page}.html`)).href + '?full');
const frames = await tab.$$('.frame');
for (let i = 0; i < frames.length; i++) {
  const file = join(out, `${String(i + 1).padStart(2, '0')}.png`);
  await frames[i].screenshot({ path: file });
}
await browser.close();
console.log(`${frames.length} slides -> ${out}`);
