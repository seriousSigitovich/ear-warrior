// Voices of ep. 4 (voice.ai TTS, same key as the other episodes): one mp3 per line of LINES in story.mjs → twinkle/voice/, plus
// twinkle/voice-meta.json (the length of every line in seconds, so the captions can pace the words).
//   node twinkle/voice.mjs [--force]
// voice.ai has no child voice: Emma is the youngest public one, "Ellie", and audio.mjs pitches her up (rubberband, a mild 1.3); the dad is "Matt".
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tts, DEFAULT_VOICE } from '../pain/voice.mjs';
import { LINES } from './story.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const VOICE_DIR = join(here, 'voice');
const VOICES = { narrator: DEFAULT_VOICE, emma: 'd1bf0f33-8e0e-4fbf-acf8-45c3c6262513', dad: 'c9530f8a-dcb5-4db3-aed0-690694247a1a' };   // dad = "Matt", an ordinary American adult (Ryan's deep South African narrator voice did not fit a dad)

export const voicePath = (i) =>
  join(VOICE_DIR, `line-${i}-${createHash('sha1').update(`${VOICES[LINES[i].who]}|${LINES[i].say}`).digest('hex').slice(0, 8)}.mp3`);

export async function generateVoice(force = false) {
  const key = process.env.VOICE_AI_API_KEY || process.env.AI_VOICE_TOKEN;
  if (!key) throw new Error('no voice.ai key: set AI_VOICE_TOKEN in server/.env or VOICE_AI_API_KEY in assets/video/remotion/.env');
  mkdirSync(VOICE_DIR, { recursive: true });
  const meta = [];
  for (let i = 0; i < LINES.length; i++) {
    console.log(`voice: line ${i} ${(await tts(key, LINES[i].say, VOICES[LINES[i].who], voicePath(i), force)) ? 'generated' : 'kept'}`);
    const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', voicePath(i)]).toString().trim();
    meta.push(Math.round(Number(out) * 100) / 100);
  }
  writeFileSync(join(here, 'voice-meta.json'), JSON.stringify(meta));
  return meta;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateVoice(process.argv.includes('--force')).catch((e) => { console.error(e.message); process.exit(1); });
}
