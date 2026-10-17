// Fetches a YouTube video's transcript as clean text via yt-dlp (captions first, Whisper as fallback).
// Usage: node scripts/research/youtube-transcript.mjs <url|videoId> [outDir] [--lang en]
// Needs: yt-dlp (brew install yt-dlp). Fallback needs ffmpeg and a whisper CLI (`whisper` or `whisper-cli`).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const langIdx = args.indexOf('--lang');
const LANG = langIdx >= 0 ? args.splice(langIdx, 2)[1] : 'en';
const [input, outDirArg] = args;
if (!input) {
  console.error('Usage: node scripts/research/youtube-transcript.mjs <url|videoId> [outDir] [--lang en]');
  process.exit(1);
}
const OUT_DIR = outDirArg ?? 'docs/research/transcripts';
const URL = /^https?:/.test(input) ? input : `https://www.youtube.com/watch?v=${input}`;

const has = (cmd) => spawnSync('which', [cmd]).status === 0;
if (!has('yt-dlp')) {
  console.error('yt-dlp not found. Install: brew install yt-dlp');
  process.exit(1);
}

const run = (cmd, a) => execFileSync(cmd, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

// Rolling auto-captions repeat each line in the next cue, so drop consecutive duplicates.
function vttToText(vtt) {
  const out = [];
  for (const raw of vtt.split('\n')) {
    if (/^(WEBVTT|Kind:|Language:|NOTE)/.test(raw) || /-->/.test(raw)) continue;
    const line = raw.replace(/<[^>]+>/g, '').trim();
    if (line && line !== out[out.length - 1]) out.push(line);
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

function fromCaptions(dir, id) {
  // Ask for the original-language track on its own first: YouTube rate-limits (429) the auto-translated
  // tracks, and one failed language makes yt-dlp bail out before the others are written.
  for (const langs of [`${LANG}-orig`, LANG]) {
    spawnSync('yt-dlp', [
      '--skip-download', '--write-subs', '--write-auto-subs',
      '--sub-langs', langs, '--sub-format', 'vtt',
      '-o', join(dir, '%(id)s'), URL,
    ], { stdio: 'ignore' });
    const file = readdirSync(dir).find((f) => f.startsWith(id) && f.endsWith('.vtt'));
    if (file) return vttToText(readFileSync(join(dir, file), 'utf8'));
  }
  return null;
}

function fromWhisper(dir, id) {
  const bin = ['whisper-cli', 'whisper'].find(has);
  if (!bin || !has('ffmpeg')) {
    throw new Error('No captions found, and Whisper fallback needs ffmpeg + `whisper` (pip install openai-whisper) or `whisper-cli`.');
  }
  const wav = join(dir, `${id}.wav`);
  run('yt-dlp', ['-x', '--audio-format', 'wav', '-o', join(dir, '%(id)s.%(ext)s'), URL]);
  if (bin === 'whisper') {
    run('whisper', [wav, '--language', LANG, '--output_format', 'txt', '--output_dir', dir]);
    return readFileSync(join(dir, `${id}.txt`), 'utf8').replace(/\s+/g, ' ').trim();
  }
  return run('whisper-cli', ['-f', wav, '-l', LANG, '-nt']).replace(/\s+/g, ' ').trim();
}

// Only the fields we need: the full JSON dump can exceed 1 MB on videos with many dubbed audio tracks.
const meta = JSON.parse(run('yt-dlp', ['--skip-download', '--print', '%(.{id,title,channel,duration,view_count,webpage_url})j', URL]));
const tmp = mkdtempSync(join(tmpdir(), 'yt-transcript-'));
try {
  let source = 'captions';
  let text = fromCaptions(tmp, meta.id);
  if (!text) {
    source = 'whisper';
    text = fromWhisper(tmp, meta.id);
  }
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const outFile = join(OUT_DIR, `${meta.id}.txt`);
  const header = [`# ${meta.title}`, `# ${meta.channel} · ${Math.round(meta.duration / 60)} min · ${meta.view_count ?? '?'} views`, `# ${meta.webpage_url} · source: ${source}`, '', ''].join('\n');
  writeFileSync(outFile, header + text + '\n');
  console.log(`${outFile} (${text.split(' ').length} words, ${source})`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
