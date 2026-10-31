// The narrator of the 3D Mozart cut: the bouncing-ball narrator (spring/voice.mjs) on this timeline.   node mozart/voice.mjs [--force]
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { narrator } from '../spring/voice.mjs';
import * as S from './story.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const { LINES, generateVoice, loadLines } = narrator(S, join(here, 'voice'), 'MOZART_VOICE_ID');

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateVoice(process.argv.includes('--force')).catch((e) => { console.error(e.message); process.exit(1); });
}
