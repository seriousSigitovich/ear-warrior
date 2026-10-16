// What a rendered file is (ffprobe) and whether each platform will take it. Pure except probeVideo().
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PublishError, type PlatformName } from './types.js';

export interface Probe {
  durationS: number;
  width: number;
  height: number;
  videoCodec: string | null;
  audioCodec: string | null;
  sizeBytes: number;
}

const MAX_INSTAGRAM_BYTES = 100 * 1024 * 1024;
const MAX_SECONDS = 180; // Shorts limit; also the conservative Reels limit for this project's content

/** "…/ear-challenge-31.mp4" -> 31 (the experiment number used by docs/experiments.md). */
export function videoNoFromFile(file: string): number | null {
  const m = /ear-challenge-(\d{1,3})/i.exec(file);
  return m ? Number(m[1]) : null;
}

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  duration?: string;
}

/** Maps `ffprobe -print_format json -show_streams -show_format` output to a Probe. */
export function parseProbe(json: unknown): Probe {
  if (!json || typeof json !== 'object') throw new PublishError('ffprobe returned nothing usable for this file');
  const j = json as { streams?: FfprobeStream[]; format?: { duration?: string; size?: string } };
  const streams = j.streams ?? [];
  const video = streams.find((s) => s.codec_type === 'video');
  if (!video) throw new PublishError('No video stream found in the file');
  const audio = streams.find((s) => s.codec_type === 'audio');
  return {
    durationS: Number(j.format?.duration ?? video.duration ?? 0),
    width: Number(video.width),
    height: Number(video.height),
    videoCodec: video.codec_name ?? null,
    audioCodec: audio?.codec_name ?? null,
    sizeBytes: Number(j.format?.size ?? 0),
  };
}

/** Plain-language problems that would make `platform` reject or mishandle the file; [] = fine. */
export function validateForPlatform(p: Probe, platform: PlatformName): string[] {
  const problems: string[] = [];
  const ratio = p.height > 0 ? p.width / p.height : 0;
  if (!(ratio >= 0.5 && ratio <= 0.6)) problems.push(`not vertical 9:16 (${p.width}x${p.height})`);
  if (p.videoCodec !== 'h264') problems.push(`video codec is ${p.videoCodec ?? 'unknown'}, need H.264`);
  if (p.audioCodec !== null && p.audioCodec !== 'aac') problems.push(`audio codec is ${p.audioCodec}, need AAC`);
  if (platform === 'youtube' && p.durationS > MAX_SECONDS) {
    problems.push(`${Math.round(p.durationS)} s is longer than 3 minutes — not a Short`);
  }
  if (platform === 'instagram') {
    if (p.durationS > MAX_SECONDS) problems.push(`${Math.round(p.durationS)} s is longer than 3 minutes — too long for a Reel`);
    if (p.durationS < 3) problems.push(`${p.durationS.toFixed(1)} s is shorter than 3 seconds — too short for a Reel`);
    if (p.sizeBytes > MAX_INSTAGRAM_BYTES) problems.push(`file is over 100 MB (${Math.round(p.sizeBytes / 1024 / 1024)} MB)`);
  }
  return problems;
}

const exec = promisify(execFile);

export async function probeVideo(file: string): Promise<Probe> {
  try {
    const { stdout } = await exec('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file], { maxBuffer: 4 * 1024 * 1024 });
    return parseProbe(JSON.parse(stdout));
  } catch (err) {
    if (err instanceof PublishError) throw err;
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') throw new PublishError('ffprobe not found — install ffmpeg (brew install ffmpeg)');
    throw new PublishError(`Could not read ${file} with ffprobe: ${(err as Error).message.split('\n')[0]}`);
  }
}
