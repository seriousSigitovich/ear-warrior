// Voices of the jam episode (voice.ai TTS, the same key and client as the pain cut): one mp3 per line of LINES in story.mjs → jam/voice/.
//   node jam/voice.mjs [--force]
// The narrator is the pain cut's "Ryan"; the bassist speaks with a public female voice. File names hash voice + text, so editing a line
// regenerates just that line.
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tts, DEFAULT_VOICE } from '../pain/voice.mjs';
import { LINES } from './story.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const VOICE_DIR = join(here, 'voice');
const VOICES = { narrator: DEFAULT_VOICE, bassist: 'e16986bd-1ce9-4c1c-88e7-bbe02b1340d1' };   // bassist = "Alicia"

export const voicePath = (i) =>
  join(VOICE_DIR, `line-${i}-${createHash('sha1').update(`${VOICES[LINES[i].who]}|${LINES[i].say}`).digest('hex').slice(0, 8)}.mp3`);

export async function generateVoice(force = false) {
  const key = process.env.VOICE_AI_API_KEY || process.env.AI_VOICE_TOKEN;
  if (!key) throw new Error('no voice.ai key: set AI_VOICE_TOKEN in server/.env or VOICE_AI_API_KEY in assets/video/remotion/.env');
  mkdirSync(VOICE_DIR, { recursive: true });
  for (let i = 0; i < LINES.length; i++) console.log(`voice: line ${i} ${(await tts(key, LINES[i].say, VOICES[LINES[i].who], voicePath(i), force)) ? 'generated' : 'kept'}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateVoice(process.argv.includes('--force')).catch((e) => { console.error(e.message); process.exit(1); });
}
