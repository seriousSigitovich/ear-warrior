// Scans a folder of Nottingham ABC files for runs of notes that could fill the library plan, and
// prints which cells of the plan (note band × base) the corpus could close. Reads only; it adds
// nothing to candidates.ts — pick tunes from the examples and add them by hand.
//
//   server/node_modules/.bin/tsx scripts/abc-scan.ts <dir> [--examples N] [--loose]
//
// A window is 3–16 consecutive notes of one tune that starts on a bar line (or the start of a part)
// and, unless --loose, ends on one too. It is moved by whole octaves onto the 12-fret neck, and must
// use at least 3 different pitches and no leap above an octave. Windows with the same interval
// pattern count once, so a tune that appears in two keys is not counted twice.
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { CANDIDATES } from '../src/services/melody/candidates';
import { parseAbc } from '../src/services/melody/abc';
import {
  Base,
  NOTE_BANDS,
  bandOf,
  classify,
  fitToNeck,
  parseMelody,
} from '../src/services/melody/classify';
import { CURATED } from '../src/services/melody/curated';
import { BASES, TARGET, cellCounts } from '../src/services/melody/plan';
import { noteName } from '../src/lib/pitchNote';

const MAX_NOTES = NOTE_BANDS[NOTE_BANDS.length - 1].max;
const MIN_NOTES = NOTE_BANDS[0].min;
/** The corpus owner of this subset keeps the rights; never read it. */
const EXCLUDED_FILES = new Set(['ashover.abc']);

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--examples');
const loose = args.includes('--loose');
const exampleFlag = args.indexOf('--examples');
const examplesPerCell = exampleFlag >= 0 ? Number(args[exampleFlag + 1]) : 2;
if (!dir) {
  console.error('usage: abc-scan.ts <dir> [--examples N] [--loose]');
  process.exit(1);
}

interface Window {
  tune: string;
  file: string;
  midis: number[];
  beats: number[];
  base: Base;
  maxLeap: number;
}

const cells = NOTE_BANDS.map(() =>
  BASES.map(() => ({ windows: new Map<string, Window>(), tunes: new Set<string>() })),
);
let tuneCount = 0;
let segmentCount = 0;
let windowCount = 0;
const skipped: string[] = [];

const files = readdirSync(dir)
  .filter((f) => f.endsWith('.abc') && !EXCLUDED_FILES.has(f))
  .sort();
for (const file of files) {
  const parsed = parseAbc(readFileSync(join(dir, file), 'utf8'));
  for (const s of parsed.skipped) skipped.push(`${file} #${s.number} ${s.title} (${s.reason})`);
  for (const tune of parsed.tunes) {
    tuneCount++;
    for (const seg of tune.segments) {
      segmentCount++;
      for (let i = 0; i < seg.length; i++) {
        if (i !== 0 && !seg[i].barStart) continue;
        for (let n = MIN_NOTES; n <= MAX_NOTES && i + n <= seg.length; n++) {
          if (!loose && i + n < seg.length && !seg[i + n].barStart) continue;
          const slice = seg.slice(i, i + n);
          const midis = fitToNeck(slice.map((x) => x.midi));
          if (!midis || new Set(midis).size < 3) continue;
          const c = classify(midis);
          if (c.maxLeap > 12) continue;
          const band = NOTE_BANDS.indexOf(bandOf(n)!);
          const cell = cells[band][BASES.indexOf(c.base)];
          windowCount++;
          const key = midis.map((m) => m - midis[0]).join(',');
          if (!cell.windows.has(key)) {
            cell.windows.set(key, {
              tune: tune.title,
              file: `${file} #${tune.number}`,
              midis,
              beats: slice.map((x) => x.beats),
              base: c.base,
              maxLeap: c.maxLeap,
            });
          }
          cell.tunes.add(`${file}#${tune.number}`);
        }
      }
    }
  }
}

const existing = cellCounts(
  [...CURATED, ...CANDIDATES].map((t) => classify(parseMelody(t.notes).map((n) => n.midi))),
);
const pad = (s: string | number, n: number) => String(s).padEnd(n);

console.log(`${files.length} files, ${tuneCount} tunes, ${segmentCount} segments, ${windowCount} windows`);
console.log(`skipped ${skipped.length} tunes${skipped.length ? ':' : ''}`);
for (const s of skipped) console.log('  ' + s);

console.log('\nStill needed → what the corpus offers (unique windows / distinct tunes)\n');
console.log(pad('notes', 8) + BASES.map((b) => pad(b, 24)).join(''));
let stillNeeded = 0;
let closable = 0;
NOTE_BANDS.forEach((band, i) => {
  const row = BASES.map((_, j) => {
    const need = Math.max(0, TARGET[i][j] - existing[i][j]);
    const { windows, tunes } = cells[i][j];
    stillNeeded += need;
    closable += Math.min(need, tunes.size);
    return pad(need === 0 ? 'full' : `need ${need}: ${windows.size}w/${tunes.size}t`, 24);
  });
  console.log(pad(band.label, 8) + row.join(''));
});
console.log(`\nstill needed ${stillNeeded} of 100; the corpus has enough distinct tunes for ${closable}`);

console.log(`\nExamples (${examplesPerCell} per open cell, smallest leap first, one per tune)\n`);
NOTE_BANDS.forEach((band, i) => {
  BASES.forEach((base, j) => {
    if (TARGET[i][j] - existing[i][j] <= 0) return;
    const seen = new Set<string>();
    const picks = [...cells[i][j].windows.values()]
      .sort((a, b) => a.maxLeap - b.maxLeap || a.tune.localeCompare(b.tune))
      .filter((w) => !seen.has(w.file) && seen.add(w.file))
      .slice(0, examplesPerCell);
    console.log(`${band.label} notes, ${base}: ${picks.length ? '' : 'nothing found'}`);
    for (const w of picks) {
      const notes = w.midis
        .map((m, k) => `${noteName(m)}:${Math.max(0.25, Math.round(w.beats[k] * 4) / 4)}`)
        .join(' ');
      console.log(`  ${w.tune} (${w.file}, leap ${w.maxLeap})\n    ${notes}`);
    }
  });
});
