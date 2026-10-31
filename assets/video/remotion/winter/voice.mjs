// The narrator of the Winter cut: a calm female voice (voice.ai TTS) that reads the on-screen beats and never talks over the melody.
//   node winter/voice.mjs [--force]      one mp3 per line → winter/voice/ (git-ignored; the name carries a hash of voice + text)
// Key: AI_VOICE_TOKEN in server/.env (or VOICE_AI_API_KEY in assets/video/remotion/.env). WINTER_VOICE_ID overrides the voice.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tts } from '../pain/voice.mjs';
import { SR } from '../../synth.mjs';
import { T, HEARD, DURATION } from './story.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const VOICE_DIR = join(here, 'voice');

/** "Emma - British Female". The other public female voices: Alicia (American), Lauren (American), Ellie. */
const EMMA = '44de4286-f7aa-4216-845f-807103e33ac8';
const voiceId = () => process.env.WINTER_VOICE_ID || EMMA;

/** Each line starts at `at` and must be over by `until` (sped up to ×1.3 at most if it runs long): the melody windows stay voice-free. */
export const LINES = [
  { at: 0.05, until: T.listenAt - 0.12, say: 'Can you play this by ear?' },
  { at: T.challenge + 0.05, until: T.challenge + 3, say: 'Now find the notes. Seven seconds.' },
  { at: T.reveal + 0.02, until: T.answerAt - 0.1, say: 'Time’s up.' },
  { at: T.q, until: DURATION - 0.25, say: 'Did you get it? Comment your score.' },
];
if (LINES[0].until > HEARD[0].t) throw new Error('the hook line would run into the melody');

const voicePath = (i) => join(VOICE_DIR, `line-${i}-${createHash('sha1').update(`${voiceId()}|${LINES[i].say}`).digest('hex').slice(0, 8)}.mp3`);

export async function generateVoice(force = false) {
  const key = process.env.VOICE_AI_API_KEY || process.env.AI_VOICE_TOKEN;
  if (!key) throw new Error('no voice.ai key: set AI_VOICE_TOKEN in server/.env or VOICE_AI_API_KEY in assets/video/remotion/.env');
  mkdirSync(VOICE_DIR, { recursive: true });
  for (let i = 0; i < LINES.length; i++) console.log(`voice: line ${i} ${(await tts(key, LINES[i].say, voiceId(), voicePath(i), force)) ? 'generated' : 'kept'}`);
}

/** A line as mono samples at SR, its trailing silence (~0.4 s in every voice.ai file) cut, sped up (≤ ×1.3, never slowed) to fit `maxSec`. */
function loadLine(file, maxSec) {
  const read = (tempo) => {
    const b = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-af', `areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,atempo=${tempo}`, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
    return new Float32Array(b.buffer, b.byteOffset, b.length / 4).slice();
  };
  let v = read(1);
  if (v.length / SR > maxSec) {
    const tempo = v.length / SR / maxSec;
    if (tempo > 1.3) throw new Error(`${file}: ${(v.length / SR).toFixed(2)} s does not fit ${maxSec.toFixed(2)} s even at ×1.3 — shorten the line`);
    console.log(`  voice ${file.split('/').pop()}: ${(v.length / SR).toFixed(2)} s > ${maxSec.toFixed(2)} s → ×${tempo.toFixed(2)}`);
    v = read(tempo);
  }
  return v;
}

/** The lines that exist on disk, as { at, until, samples } for ten/audio.mjs. */
export const loadLines = () => LINES.flatMap((l, i) => (existsSync(voicePath(i)) ? [{ ...l, samples: loadLine(voicePath(i), l.until - l.at) }] : []));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateVoice(process.argv.includes('--force')).catch((e) => { console.error(e.message); process.exit(1); });
}
