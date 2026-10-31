#!/usr/bin/env node
// Quality gate for the 3D Mozart cut's soundtrack (spring/check.mjs's checks on this timeline).   node mozart/check.mjs  (after render-mozart.mjs)
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkBounce } from '../spring/check.mjs';
import { CLASSICS } from '../../challenge/classics.mjs';
import * as S from './story.mjs';
import { LINES } from './voice.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// challenge #44's notes, read from the Mutopia MIDI
const ref = CLASSICS.find((c) => c.id === 44).notes.map((n) => `${n.name.replace('#', '♯')}:${String(n.beats).replace(/^0/, '')}`).join(' ');
process.exit(checkBounce({ S, LINES, wav: join(here, '..', 'public', 'mozart-3d.wav'), ref }) ? 1 : 0);
