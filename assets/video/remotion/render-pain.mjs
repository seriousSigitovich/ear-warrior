#!/usr/bin/env node
// The 60 s "tabs guy" pain sketch:  node render-pain.mjs   →  public/ear-pain.wav + out/ear-pain.mp4 (1080×1920, 60 fps)
// Story, timings and every note live in pain/story.mjs; the picture is src/pain/PainVideo.tsx.   --audio-only for just the soundtrack.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPainAudio, renderPainCutAudio } from './pain/audio.mjs';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'out'), { recursive: true });
if (process.argv.includes('--cut')) {
  // The 19 s cut with narration:  node render-pain.mjs --cut [--voice]  (--voice first fetches the lines from voice.ai; needs VOICE_AI_API_KEY)
  if (process.argv.includes('--voice')) await (await import('./pain/voice.mjs')).generateVoice(process.argv.includes('--force'));
  const { peak, voiced } = renderPainCutAudio(join(here, 'public', 'ear-pain-cut.wav'));
  console.log(`ear-pain-cut: audio peak ${peak.toFixed(2)}, ${voiced} narrator lines${voiced ? '' : ' (none — run with --voice)'}`);
  if (process.argv.includes('--audio-only')) process.exit(0);
  const cut = join(here, 'out', 'ear-pain-cut.mp4');
  execFileSync(join(here, 'node_modules', '.bin', 'remotion'), ['render', 'src/index.ts', 'PainCut', cut, '--concurrency=8', '--log=error'], { cwd: here, stdio: 'inherit' });
  console.log(`ear-pain-cut: → ${cut}`);
  process.exit(0);
}
const peak = renderPainAudio(join(here, 'public', 'ear-pain.wav'));
console.log(`ear-pain: audio peak ${peak.toFixed(2)}`);
if (process.argv.includes('--audio-only')) process.exit(0);
const mp4 = join(here, 'out', 'ear-pain.mp4');
execFileSync(join(here, 'node_modules', '.bin', 'remotion'), ['render', 'src/index.ts', 'Pain', mp4, '--concurrency=8', '--log=error'], { cwd: here, stdio: 'inherit' });
console.log(`ear-pain: → ${mp4}`);
