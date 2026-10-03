// Freezes the challenge melodies into challenges.json by running the app's own generator
// (src/services/melody) on a fixed [level, seed]. Frozen on purpose: the generator keeps improving, and a
// published video must not change under us when it does.
// Usage: node gen-melodies.mjs      (re-run only to add or change a challenge in PLAN below)
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '../../..');
const require = createRequire(import.meta.url);
const ts = require(join(repo, 'node_modules/typescript'));

// The generator is pure TypeScript with no native imports: transpile the few modules it needs to CJS
// in a temp dir and require them. `../../models` is type-only, so it is elided.
const tmp = mkdtempSync(join(tmpdir(), 'ew-melody-'));
for (const rel of ['lib/pitchNote', 'services/melody/generator', 'services/melody/levels', 'services/melody/scales']) {
  const js = ts.transpileModule(readFileSync(join(repo, 'src', rel + '.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const dst = join(tmp, 'src', rel + '.js');
  mkdirSync(dirname(dst), { recursive: true });
  writeFileSync(dst, js);
}
const { generateMelody } = require(join(tmp, 'src/services/melody/generator.js'));
const { getLevelByRank } = require(join(tmp, 'src/services/melody/levels.js'));

// One entry per video. Seeds were picked by reading the candidates: short enough for the 15 s format
// (see timeline.mjs), small leaps, a clear ending. `hook` is the opening headline: "\n" breaks a line,
// *word* is accented. `tempoBpm` is the app's 90 unless a longer phrase must be sped up to fit.
// `coldOpen` starts the melody on frame 0 (no silent hook); `layout: 'keyboard'` keeps a big keyboard on screen
// the whole video and sets the headline large (see slides.html). Both default to off.
const PLAN = [
  { id: 1, level: 1, seed: 2, timbre: 'pluck', tempoBpm: 90, hook: 'Can you play\nthis *by ear?*' },
  { id: 2, level: 2, seed: 3, timbre: 'keys', tempoBpm: 90, hook: 'Think your ear\nis *good?*' },
  { id: 3, level: 3, seed: 1, timbre: 'pluck', tempoBpm: 110, hook: 'Sounds easy.\n*Play it back.*' },
  { id: 4, level: 5, seed: 3, timbre: 'keys', tempoBpm: 90, hook: 'No tabs.\nNo sheet music.\n*Just your ear.*' },
  { id: 5, level: 7, seed: 6, timbre: 'voice', tempoBpm: 90, hook: 'Minor key.\n*One listen.*' },
  // Same level, length and timbre as #4 on purpose: only the opening differs, so the two compare cleanly.
  { id: 6, level: 5, seed: 10, timbre: 'keys', tempoBpm: 90, hook: 'Play this\n*by ear.*', coldOpen: true, layout: 'keyboard' },
  // Same layout as #6, a different hook: a dare in the first second. Different melody, same level.
  { id: 7, level: 5, seed: 15, timbre: 'keys', tempoBpm: 90, hook: 'Think your\near is *good?*', coldOpen: true, layout: 'keyboard' },
];

const ROOT_PC = { C: 0, 'C#': 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };

const challenges = PLAN.map(({ id, level, seed, timbre, tempoBpm, hook, ...opts }) => {
  const m = generateMelody(getLevelByRank(level), seed);
  const [root, ...family] = m.scale.split('_');
  return {
    id, level, seed, timbre, tempoBpm, hook, ...opts,
    scale: family.join(' '),
    tonicPc: ROOT_PC[root],
    minor: family.includes('minor'),
    key: `${root} ${family.join(' ')}`,
    notes: m.notes.map(n => ({ midi: n.midi, name: n.noteName, beats: n.durationBeats })),
  };
});

writeFileSync(join(here, 'challenges.json'), JSON.stringify(challenges, null, 2) + '\n');
for (const c of challenges) console.log(`#${c.id} L${c.level} ${c.key.padEnd(24)} ${c.notes.map(n => n.name).join(' ')}`);
