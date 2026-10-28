// The 100-melody plan: how many tunes each note band and base should hold (pure, no IO).
import { Base, NOTE_BANDS, bandOf } from './classify';

export const BASES: readonly Base[] = ['pentatonic', 'diatonic', 'chromatic'];

/** Planned tunes per note band (rows, in NOTE_BANDS order) and base (columns, in BASES order): 100 in all. */
export const TARGET: readonly (readonly number[])[] = [
  [6, 6, 3],
  [6, 10, 4],
  [6, 12, 4],
  [8, 13, 5],
  [4, 9, 4],
];

/** Tunes per note band (rows) and base (columns). A tune outside every band is not counted. */
export function cellCounts(tunes: readonly { base: Base; noteCount: number }[]): number[][] {
  const counts = NOTE_BANDS.map(() => BASES.map(() => 0));
  for (const t of tunes) {
    const row = NOTE_BANDS.indexOf(bandOf(t.noteCount) as (typeof NOTE_BANDS)[number]);
    if (row >= 0) counts[row][BASES.indexOf(t.base)]++;
  }
  return counts;
}
