// Carousel slides: which files they are, whether Instagram will take them, and the JPEG bytes it needs.
// Instagram's content API accepts JPEG only, so PNG exports (assets/carousel/out/*) are converted with ffmpeg at publish time.
import { execFile } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { CAROUSEL_MAX, CAROUSEL_MIN } from './instagram.js';
import { PublishError } from './types.js';

const exec = promisify(execFile);
const IMAGE_EXT = /\.(png|jpe?g)$/i;
export const IG_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const MIN_RATIO = 0.8; // 4:5 portrait, the tallest Instagram shows in the feed
const MAX_RATIO = 1.91;
const MIN_WIDTH = 320;
const MAX_WIDTH = 1440;

export interface ImageProbe {
  width: number;
  height: number;
}

/** "dir" -> its images in natural order (01.png, 02.png … 10.png); "a.png,b.png" -> exactly those, in that order. */
export async function listImages(spec: string): Promise<string[]> {
  const out: string[] = [];
  for (const part of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
    const abs = resolve(part);
    let info;
    try {
      info = await stat(abs);
    } catch {
      throw new PublishError(`${part} does not exist`);
    }
    if (info.isDirectory()) {
      const names = (await readdir(abs)).filter((n) => IMAGE_EXT.test(n)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      out.push(...names.map((n) => join(abs, n)));
    } else if (IMAGE_EXT.test(abs)) {
      out.push(abs);
    } else {
      throw new PublishError(`${part} is not a PNG or JPEG image`);
    }
  }
  return out;
}

/** Plain-language problems that would make Instagram reject or crop the carousel; [] = fine. Pure. */
export function validateCarousel(probes: ImageProbe[]): string[] {
  const problems: string[] = [];
  if (probes.length < CAROUSEL_MIN || probes.length > CAROUSEL_MAX) {
    problems.push(`a carousel takes ${CAROUSEL_MIN}–${CAROUSEL_MAX} images, got ${probes.length}`);
  }
  const first = probes[0];
  probes.forEach((p, i) => {
    const ratio = p.height > 0 ? p.width / p.height : 0;
    if (ratio < MIN_RATIO || ratio > MAX_RATIO) problems.push(`image ${i + 1} is ${p.width}x${p.height}: Instagram takes aspect ratios from 4:5 to 1.91:1`);
    if (p.width < MIN_WIDTH || p.width > MAX_WIDTH) problems.push(`image ${i + 1} is ${p.width} px wide: Instagram takes ${MIN_WIDTH}–${MAX_WIDTH} px`);
    if (first && (p.width !== first.width || p.height !== first.height)) problems.push(`image ${i + 1} is ${p.width}x${p.height}, the first is ${first.width}x${first.height}: Instagram would crop them to one shape`);
  });
  return problems;
}

export async function probeImage(file: string): Promise<ImageProbe> {
  try {
    const { stdout } = await exec('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', file]);
    const s = (JSON.parse(stdout) as { streams?: { width?: number; height?: number }[] }).streams?.[0];
    if (!s?.width || !s.height) throw new PublishError(`${file} has no readable image stream`);
    return { width: s.width, height: s.height };
  } catch (err) {
    if (err instanceof PublishError) throw err;
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') throw new PublishError('ffprobe not found — install ffmpeg (brew install ffmpeg)');
    throw new PublishError(`Could not read ${file} with ffprobe: ${(err as Error).message.split('\n')[0]}`);
  }
}

/** The file as JPEG bytes: JPEGs pass through untouched, PNGs are converted (quality ≈ 95). */
export async function jpegBytes(file: string): Promise<Uint8Array> {
  if (/\.jpe?g$/i.test(file)) return readFile(file);
  try {
    const { stdout } = await exec('ffmpeg', ['-v', 'error', '-i', file, '-frames:v', '1', '-q:v', '2', '-pix_fmt', 'yuvj420p', '-f', 'mjpeg', '-'], {
      encoding: 'buffer',
      maxBuffer: 64 * 1024 * 1024,
    });
    return stdout;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') throw new PublishError('ffmpeg not found — install ffmpeg (brew install ffmpeg)');
    throw new PublishError(`Could not convert ${file} to JPEG: ${(err as Error).message.split('\n')[0]}`);
  }
}
