// Drafts phrase breaks for the tunes in library.abc, as a `%%phrases` line (note counts per phrase, e.g.
// `%%phrases 10 11 9 12`). A phrase has to stand on its own, so a break goes where the melody comes to
// rest: after a held note (a rest folds into the note before it, so it counts as held), better still on
// the tonic, and never just before a run of quick notes, which carries the line on. Phrases are kept
// near 8–12 notes, up to 16 where a shorter one would end mid-line. A draft only: the owner checks the breaks by ear and edits the line where one is off.
//
//   server/node_modules/.bin/tsx scripts/draft-phrases.ts          tunes without a %%phrases line
//   server/node_modules/.bin/tsx scripts/draft-phrases.ts --redo   every tune (overwrites edits!)
//   then `npm run library`
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseAbc } from '../src/services/melody/abc';
import { TUNES } from '../src/services/melody/library';

const FILE = join(__dirname, '..', 'src', 'services', 'melody', 'library.abc');
const PITCH: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Pitch class of "Eb4" / "F#3" / the tonic of a scale label like "Bb_major". */
function pitchClass(name: string): number {
  const m = name.match(/^([A-G])([#b]?)/);
  if (!m) throw new Error(`Bad pitch ${name}`);
  return (PITCH[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
}

/**
 * Cost of a phrase of `len` notes: free at 8–12, mild up to 16 (a whole line beats a cut one), steep
 * for scraps and run-ons.
 */
function lengthCost(len: number): number {
  if (len < 4) return 40;
  if (len < 6) return 16;
  if (len < 8) return 8;
  if (len <= 12) return 0;
  if (len <= 16) return len - 12;
  return 4 + (len - 16) ** 2;
}

interface Tune {
  beats: number[];
  pcs: number[];
  tonic: number;
  median: number;
  /** barEnd[i]: a bar line follows note i. */
  barEnd: boolean[];
}

/** How good a place the end of note `i` is to end a phrase (higher is better; negative is a bad cut). */
function breakScore(t: Tune, i: number): number {
  const { beats, pcs, tonic, median } = t;
  // Held against the tune and against its own neighbourhood: in a run of eighths among sixteenths,
  // an eighth is not a resting point.
  const near = beats.slice(Math.max(0, i - 4), i + 5).sort((a, b) => a - b);
  const local = near[Math.floor(near.length / 2)];
  const ratio = beats[i] / Math.max(median, local);
  // Only a held note is a resting point; an ordinary note is mid-line and a quick one is a cut.
  let s = ratio >= 3 ? 10 : ratio >= 2 ? 8 : ratio >= 1.5 ? 5 : ratio >= 1 ? -6 : -12;
  // A note followed by one at least as long has not arrived yet ("G A G F E | C": the figure ends on C).
  if (beats[i] > beats[i + 1]) s += 1;
  else if (ratio < 3) s -= 4;
  // Coming to rest on the tonic (or the fifth) closes a phrase; on an even note the tonic still marks it.
  if (ratio >= 1.5) s += pcs[i] === tonic ? 3 : pcs[i] === (tonic + 7) % 12 ? 1 : 0;
  else if (ratio >= 1 && pcs[i] === tonic) s += 4;
  // Quick notes right after the break carry the line on: cutting there leaves both halves hanging.
  const after = beats.slice(i + 1, i + 4);
  const run =
    after.length === 3 && after.every((b) => b < median || (b <= median && b < beats[i] / 2));
  if (run && ratio < 2) s -= 8;
  // Phrases end at a bar line; a break inside a bar splits a figure.
  s += t.barEnd[i] ? 3 : -3;
  return s;
}

/** Phrase lengths for one tune, by dynamic programming over all ways to cut it. */
export function draftPhrases(t: Tune): number[] {
  const n = t.beats.length;
  const best = new Array<number>(n + 1).fill(Infinity);
  const from = new Array<number>(n + 1).fill(-1);
  best[0] = 0;
  for (let end = 1; end <= n; end++) {
    const score = end === n ? 0 : breakScore(t, end - 1);
    for (let start = Math.max(0, end - 24); start < end; start++) {
      const cost = best[start] + lengthCost(end - start) - score;
      if (cost < best[end]) {
        best[end] = cost;
        from[end] = start;
      }
    }
  }
  const lens: number[] = [];
  for (let end = n; end > 0; end = from[end]) lens.unshift(end - from[end]);
  return lens;
}

/** Quarter-note beats in a bar of the M: field ("3/4" → 3, "6/8" → 3, "C" / "C|" → 4). */
function barBeats(block: string): number {
  const m = block.match(/^M:[ \t]*(\S+)/m)?.[1] ?? '4/4';
  if (m === 'C' || m === 'C|') return 4;
  const [num, den] = m.split('/').map(Number);
  return num && den ? (num * 4) / den : 4;
}

/**
 * Where the bar lines fall. ABC music says so note by note; a melody given as %%notes (taken from a
 * MIDI file) has no bars, so the grid is laid over it at the pickup offset that puts the most held
 * notes at the end of a bar.
 */
function barEnds(block: string, beats: number[], median: number): boolean[] {
  if (!/^%%notes/m.test(block)) {
    const notes = parseAbc(block).tunes[0]?.segments.flat() ?? [];
    if (notes.length === beats.length)
      return notes.map((_, i) => i + 1 >= notes.length || notes[i + 1].barStart);
  }
  const bar = barBeats(block);
  const step = Math.min(0.25, ...beats);
  const ends = (offset: number) => {
    let pos = offset;
    return beats.map((b) => {
      pos += b;
      const r = pos % bar;
      return r < 1e-6 || bar - r < 1e-6;
    });
  };
  let best = ends(0);
  let bestHits = -1;
  for (let o = 0; o < bar - 1e-6; o += step) {
    const e = ends(o);
    const hits = e.filter((end, i) => end && beats[i] >= 1.5 * median).length;
    if (hits > bestHits) {
      best = e;
      bestHits = hits;
    }
  }
  return best;
}

const redo = process.argv.includes('--redo');
const byId = new Map(TUNES.map((t) => [t.id, t]));
let source = readFileSync(FILE, 'utf8');
if (redo) source = source.replace(/^%%phrases[^\n]*\n/gm, '');
let drafted = 0;
const out = source
  .split(/^(?=X:)/m)
  .map((block) => {
    const id = block.match(/^%%id[ \t]+(\w+)/m)?.[1];
    if (!id || /^%%phrases/m.test(block)) return block;
    const tune = byId.get(id);
    if (!tune)
      throw new Error(`${id} is in library.abc but not in library.ts: run npm run library first`);
    drafted++;
    const tokens = tune.notes.split(' ');
    const beats = tokens.map((x) => Number(x.split(':')[1]));
    const median = [...beats].sort((a, b) => a - b)[Math.floor(beats.length / 2)];
    const lens = draftPhrases({
      beats,
      pcs: tokens.map((x) => pitchClass(x)),
      tonic: pitchClass(tune.scale),
      median,
      barEnd: barEnds(block, beats, median),
    });
    return block.replace(/^(%%level[^\n]*\n)/m, `$1%%phrases ${lens.join(' ')}\n`);
  })
  .join('');
writeFileSync(FILE, out);
console.log(`drafted phrases for ${drafted} tunes`);
