// The answer key for the comment checker (server `npm run comments`): every published video in docs/published.json whose melody
// lives in this folder, with the notes the viewer hears, keyed by the post ids on each platform.
//   node answer-key.mjs   →  docs/answer-key.json   (re-run after publishing a new cut)
// Plus a few older videos from ../challenge (OLD below), and the names people call each tune (ALIASES).
// Videos whose tune is not found here (sketches, the band episode, riffs from the old challenge pipeline) are listed as skipped:
// their comments still show up in the report, marked "no key".
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TUNES } from './king/tunes.mjs';
import { CLASSICS } from '../challenge/classics.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '../../..');

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** "G#3" / "Eb4" → MIDI. */
function midiOf(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`answer-key: bad note ${name}`);
  return 12 * (Number(m[3]) + 1) + LETTER[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const fromJson = (id) => JSON.parse(readFileSync(join(here, 'tunes', `${id}.json`), 'utf8')).listen.split(/\s+/).map((t) => midiOf(t.split(':')[0]));
const fromStory = async (dir) => (await import(`./${dir}/story.mjs`)).MELODY.map((n) => n.midi);
const fromTune = (id) => TUNES[id].MELODY.map((n) => n.midi);

/** Output file name (without .mp4) → [tune name, notes]. */
async function melodyFor(stem) {
  const story = { 'king-neon': 'king', 'ten-neon': 'neon', 'neon-recut': 'neon', 'ten-second': 'ten', 'ten-winter': 'winter',
    'mozart-3d': 'mozart', 'toccata-minimal': 'toccata', 'bee-minimal': 'bee', 'swan-minimal': 'swan', 'spring-bounce': 'spring' }[stem];
  if (story) return [story, await fromStory(story)];
  if (stem === 'rising-wood') return ['rising', fromTune('rising')];
  if (stem === 'rising-band') return ['risingBand', fromTune('risingBand')];
  const t = /^(?:king|wood)-([a-z]+?)(?:-send)?$/.exec(stem)?.[1];
  if (t && TUNES[t]) return [t, fromTune(t)];
  if (['turkish-march', 'vivaldi-spring', 'vivaldi-summer'].includes(stem)) return [stem, fromJson(stem)];
  return null;
}

/** What people call each tune when they answer with its name instead of its notes (lower case; matched as whole words). */
const ALIASES = {
  koro: ['korobeiniki', 'korobeyniki', 'tetris', 'коробейники', 'тетрис'],
  fifth: ['5th symphony', 'fifth symphony', 'beethoven 5', "beethoven's 5th", 'бетховен'],
  bee: ['bumblebee', 'bumble bee', 'шмеля'],
  bella: ['bella ciao', 'белла чао'],
  rising: ['rising sun', 'дом восходящего солнца'],
  risingBand: ['rising sun', 'дом восходящего солнца'],
  canon: ['canon in d', 'pachelbel', 'канон'],
  scarborough: ['scarborough'],
  greensleeves: ['greensleeves', 'green sleeves'],
  birthday: ['happy birthday', 'с днем рождения'],
  gladiators: ['gladiators', 'entry of the gladiators', 'circus theme', 'выход гладиаторов'],
  darkeyes: ['dark eyes', 'ochi chernye', 'ochi chornye', 'очи черные', 'очи чёрные'],
  king: ['mountain king', 'hall of the mountain', 'peer gynt', 'пещере горного короля'],
  neon: ['nu pogodi', 'nu, pogodi', 'ну погоди', 'ну, погоди'],
  winter: ['vivaldi', 'four seasons'],
  mozart: ['eine kleine', 'nachtmusik', 'night music', 'serenade no. 13'],
  toccata: ['toccata', 'токката'],
  swan: ['swan lake', 'лебединое'],
  spring: ['vivaldi', 'four seasons'],
  'turkish-march': ['turkish march', 'rondo alla turca', 'alla turca', 'турецкий марш'],
  'vivaldi-spring': ['vivaldi', 'four seasons'],
  'vivaldi-summer': ['vivaldi', 'four seasons'],
  'ode-to-joy': ['ode to joy', 'beethoven', 'ода к радости'],
  twinkle: ['twinkle', 'abc song', 'alphabet song', 'baa baa'],
};

/** Videos from before docs/published.json (the old challenge pipeline, classics.mjs): YouTube id → classics id, matched by
 *  date, length and hook against docs/experiments.md. Only the ones people answered with notes. */
const OLD = [
  { youtube: 'QcV6JHWIJkk', classic: 8, tune: 'ode-to-joy' },   // posted 2026-10-04 09:59, 0:15, "Can you play this by ear? 90% get it wrong"
  { youtube: 'FrijsPovN60', classic: 12, tune: 'twinkle' },     // posted 2026-10-05, Twinkle (experiments: #12 on YouTube that day)
];

const ledger = JSON.parse(readFileSync(join(repo, 'docs/published.json'), 'utf8'));
const byFileAndNo = new Map();
const skipped = new Set();
for (const e of ledger) {
  const key = `${e.file}#${e.videoNo}`;
  let entry = byFileAndNo.get(key);
  if (!entry) {
    const found = await melodyFor(basename(e.file, '.mp4'));
    if (!found) { skipped.add(basename(e.file)); continue; }
    entry = { videoNo: e.videoNo, file: e.file, tune: found[0], notes: found[1], names: found[1].map((m) => NAMES[m % 12] + (Math.floor(m / 12) - 1)), posts: {} };
    byFileAndNo.set(key, entry);
  }
  entry.posts[e.platform] = e.postId;
  entry.title ??= e.title;
}

const classicNotes = (id) => {
  const c = CLASSICS.find((x) => x.id === id);
  if (!c) throw new Error(`answer-key: no classic #${id}`);
  return Array.isArray(c.notes) ? c.notes.map((n) => n.midi) : c.notes.trim().split(/\s+/).map((t) => midiOf(t.split(':')[0]));
};
for (const o of OLD) {
  const notes = classicNotes(o.classic);
  byFileAndNo.set(`old#${o.classic}`, { videoNo: o.classic, file: null, tune: o.tune, notes, names: notes.map((m) => NAMES[m % 12] + (Math.floor(m / 12) - 1)), posts: { youtube: o.youtube } });
}
for (const e of byFileAndNo.values()) e.aliases = ALIASES[e.tune] ?? [];

const out = [...byFileAndNo.values()];
writeFileSync(join(repo, 'docs/answer-key.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`docs/answer-key.json: ${out.length} videos with a key; skipped (no tune here): ${[...skipped].join(', ')}`);
