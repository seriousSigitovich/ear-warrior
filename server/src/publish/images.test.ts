import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { listImages, validateCarousel } from './images.js';

const slide = (w = 1080, h = 1350) => ({ width: w, height: h });

test('listImages: a folder is read in natural order and only images are taken', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ew-img-'));
  for (const n of ['10.png', '02.png', '1.png', 'notes.md', 'cover.JPG']) writeFileSync(join(dir, n), '');
  const files = await listImages(dir);
  assert.deepEqual(files.map((f) => f.split('/').pop()), ['1.png', '02.png', '10.png', 'cover.JPG']);
});

test('listImages: an explicit list keeps its order; a missing path or a non-image is explained', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ew-img-'));
  mkdirSync(join(dir, 'sub'));
  writeFileSync(join(dir, 'b.png'), '');
  writeFileSync(join(dir, 'a.png'), '');
  writeFileSync(join(dir, 'x.txt'), '');
  assert.deepEqual((await listImages(`${join(dir, 'b.png')},${join(dir, 'a.png')}`)).map((f) => f.split('/').pop()), ['b.png', 'a.png']);
  await assert.rejects(listImages(join(dir, 'nope')), /does not exist/);
  await assert.rejects(listImages(join(dir, 'x.txt')), /not a PNG or JPEG/);
});

test('validateCarousel: the exported 1080x1350 slides are fine', () => {
  assert.deepEqual(validateCarousel(Array.from({ length: 7 }, () => slide())), []);
});

test('validateCarousel: count limits, aspect ratio, width and mixed sizes are each reported', () => {
  assert.match(validateCarousel([slide()]).join('\n'), /2–10 images, got 1/);
  assert.match(validateCarousel(Array.from({ length: 11 }, () => slide())).join('\n'), /got 11/);
  assert.match(validateCarousel([slide(1080, 1920), slide(1080, 1920)]).join('\n'), /image 1 is 1080x1920.*4:5/);
  assert.match(validateCarousel([slide(200, 250), slide(200, 250)]).join('\n'), /200 px wide/);
  assert.match(validateCarousel([slide(), slide(1080, 1080)]).join('\n'), /image 2 is 1080x1080, the first is 1080x1350/);
});
