// The narrator of the bouncing-ball cuts: the Winter cut's voice (voice.ai "Emma"), two lines, both outside the melody.
//   node spring/voice.mjs [--force]      one mp3 per line → spring/voice/ (git-ignored; the name carries a hash of voice + text)
// Key: AI_VOICE_TOKEN in server/.env (or VOICE_AI_API_KEY in assets/video/remotion/.env). <CUT>_VOICE_ID overrides the voice.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tts } from '../pain/voice.mjs';
import { EMMA, loadLine } from '../winter/voice.mjs';
import * as SPRING from './story.mjs';

/** The narrator for timeline `S`, its mp3s cached in `dir`. */
export function narrator(S, dir, envVar) {
  const voiceId = () => process.env[envVar] || EMMA;
  /** Each line starts at `at` and must be over by `until` (sped up to ×1.3 at most if it runs long): the melody stays voice-free. */
  const LINES = [
    { at: 0.05, until: S.NOTES[0].t - 0.12, say: 'Can you play this by ear?' },
    { at: S.T.turn, until: S.DURATION - 0.3, say: 'Your turn. Comment the notes.' },
  ];
  const voicePath = (i) => join(dir, `line-${i}-${createHash('sha1').update(`${voiceId()}|${LINES[i].say}`).digest('hex').slice(0, 8)}.mp3`);
  async function generateVoice(force = false) {
    const key = process.env.VOICE_AI_API_KEY || process.env.AI_VOICE_TOKEN;
    if (!key) throw new Error('no voice.ai key: set AI_VOICE_TOKEN in server/.env or VOICE_AI_API_KEY in assets/video/remotion/.env');
    mkdirSync(dir, { recursive: true });
    for (let i = 0; i < LINES.length; i++) console.log(`voice: line ${i} ${(await tts(key, LINES[i].say, voiceId(), voicePath(i), force)) ? 'generated' : 'kept'}`);
  }
  /** The lines that exist on disk, as { at, until, samples } for the audio. */
  const loadLines = () => LINES.flatMap((l, i) => (existsSync(voicePath(i)) ? [{ ...l, samples: loadLine(voicePath(i), l.until - l.at) }] : []));
  return { LINES, generateVoice, loadLines };
}

const here = dirname(fileURLToPath(import.meta.url));
export const { LINES, generateVoice, loadLines } = narrator(SPRING, join(here, 'voice'), 'SPRING_VOICE_ID');

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateVoice(process.argv.includes('--force')).catch((e) => { console.error(e.message); process.exit(1); });
}
