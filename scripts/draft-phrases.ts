// Drafts phrase breaks for every tune in library.abc that has none yet, as a `%%phrases` line (note
// counts per phrase, e.g. `%%phrases 6 6 8 7`). A draft only: breaks go after long notes, with phrases
// kept near 4–10 notes; the owner checks them by ear in the app and edits the line where a break is off.
//
//   server/node_modules/.bin/tsx scripts/draft-phrases.ts   (then `npm run library`)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TUNES } from '../src/services/melody/library';

const FILE = join(__dirname, '..', 'src', 'services', 'melody', 'library.abc');

/** Cost of a phrase of `len` notes: free in the comfortable 4–10 band, rising fast outside it. */
function lengthCost(len: number): number {
  if (len < 2) return 100;
  if (len < 3) return 8;
  if (len < 4) return 1; // short calls exist ("E D C") but are rarer than 4–10
  if (len <= 10) return 0;
  return (len - 10) ** 2 * 0.8;
}

/** Reward for ending a phrase on note `i`: the longer it is against the tune's typical note, the better. */
function breakReward(beats: number[], i: number, median: number): number {
  const ratio = beats[i] / median;
  let r = ratio >= 3 ? 8 : ratio >= 2 ? 6 : ratio >= 1.5 ? 3 : 0;
  if (i + 1 < beats.length && beats[i] > beats[i + 1]) r += 1; // a long note before a shorter one
  return r;
}

/** Phrase lengths for one tune, by dynamic programming over all ways to cut it. */
export function draftPhrases(beats: number[]): number[] {
  const n = beats.length;
  const sorted = [...beats].sort((a, b) => a - b);
  const median = sorted[Math.floor(n / 2)];
  const best = new Array<number>(n + 1).fill(Infinity);
  const from = new Array<number>(n + 1).fill(-1);
  best[0] = 0;
  for (let end = 1; end <= n; end++) {
    const reward = end === n ? 0 : breakReward(beats, end - 1, median);
    for (let start = Math.max(0, end - 20); start < end; start++) {
      const cost = best[start] + lengthCost(end - start) - reward;
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

const byId = new Map(TUNES.map((t) => [t.id, t]));
const source = readFileSync(FILE, 'utf8');
let drafted = 0;
const out = source.replace(
  /^(%%id[ \t]+(\w+)\n(?:%%level[^\n]*\n))/gm,
  (whole, head: string, id: string) => {
    const tune = byId.get(id);
    if (!tune)
      throw new Error(`${id} is in library.abc but not in library.ts: run npm run library first`);
    const block = source.slice(source.indexOf(whole));
    const next = block.indexOf('\nX:');
    if (/^%%phrases/m.test(next < 0 ? block : block.slice(0, next))) return whole;
    drafted++;
    const beats = tune.notes.split(' ').map((t) => Number(t.split(':')[1]));
    return `${head}%%phrases ${draftPhrases(beats).join(' ')}\n`;
  },
);
writeFileSync(FILE, out);
console.log(`drafted phrases for ${drafted} tunes`);
