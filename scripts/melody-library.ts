// Prints where the melody library stands against the 100-melody plan: for every note band and base,
// how many tunes exist (curated + candidates) out of how many are planned, then each tune with the
// base and note count the classifier derived from its notes.
//
//   npm run melodies
import { CANDIDATES } from '../src/services/melody/candidates';
import {
  Base,
  NOTE_BANDS,
  bandOf,
  classify,
  compareDifficulty,
  parseMelody,
} from '../src/services/melody/classify';
import { CURATED } from '../src/services/melody/curated';
import { BASES, TARGET, cellCounts } from '../src/services/melody/plan';

interface Row {
  id: string;
  title: string;
  from: 'curated' | 'candidate';
  scale: string;
  base: Base;
  noteCount: number;
  maxLeap: number;
}

const rows: Row[] = [
  ...CURATED.map((t) => ({ ...t, from: 'curated' as const })),
  ...CANDIDATES.map((t) => ({ ...t, from: 'candidate' as const })),
].map((t) => {
  const c = classify(parseMelody(t.notes).map((n) => n.midi));
  return { id: t.id, title: t.title, from: t.from, scale: t.scale, ...c };
});

const counts = cellCounts(rows);

const pad = (s: string | number, n: number) => String(s).padEnd(n);

console.log('Library vs plan (have/planned)\n');
console.log(pad('notes', 8) + BASES.map((b) => pad(b, 13)).join(''));
let filled = 0; // tunes that count toward the plan: a cell never counts past its target
let planned = 0;
let surplus = 0;
NOTE_BANDS.forEach((band, i) => {
  const cells = BASES.map((_, j) => {
    const n = counts[i][j];
    filled += Math.min(n, TARGET[i][j]);
    surplus += Math.max(0, n - TARGET[i][j]);
    planned += TARGET[i][j];
    return pad(`${n}/${TARGET[i][j]}`, 13);
  });
  console.log(pad(band.label, 8) + cells.join(''));
});
const outOfBand = rows.filter((r) => bandOf(r.noteCount) === undefined);
console.log(`\nplan filled ${filled}/${planned}; ${surplus} over a cell's target`);
if (outOfBand.length) console.log(`${outOfBand.length} outside 3–16 notes`);

console.log('\nTunes, easiest first\n');
console.log(pad('notes', 6) + pad('leap', 6) + pad('base', 12) + pad('from', 11) + pad('key', 20) + 'title');
for (const r of [...rows].sort(compareDifficulty)) {
  console.log(
    pad(r.noteCount, 6) + pad(r.maxLeap, 6) + pad(r.base, 12) + pad(r.from, 11) + pad(r.scale, 20) + r.title,
  );
}
