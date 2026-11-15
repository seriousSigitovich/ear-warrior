// The last result Home shows (spec 023): how the last answered phrase (or the finished attempt) of the melody on
// screen went, note by note. Pure.
import type { NoteResult } from '../models';
import { noteName } from './pitchNote';
import { scoreOf, noteStrip, StripNote } from './review';
import { dayKey, shiftDay } from './streak';

/** Notes drawn as chips; a longer result says how many more there were. */
export const MAX_CHIPS = 16;

export interface LastResult {
  /** "Last phrase" (the melody being continued) or "Last attempt" (a finished melody). */
  kind: 'Last phrase' | 'Last attempt';
  /** "today", "yesterday", "3 days ago". */
  when: string;
  matched: number;
  total: number;
  /** The first notes, by name without the octave ("F#"), each with how it went. */
  notes: { name: string; state: StripNote }[];
  /** Notes past `MAX_CHIPS`. */
  hidden: number;
  line: string;
}

export function whenLabel(day: string, today: string): string {
  if (day === today) return 'today';
  if (day === shiftDay(today, -1)) return 'yesterday';
  let n = 2;
  while (n < 400 && shiftDay(day, n) !== today) n++;
  return `${n} days ago`;
}

/** What to say under the result. */
export function beatLine(matched: number, total: number): string {
  if (total <= 0) return '';
  if (matched >= total) return 'Clean. Try the next one.';
  const left = total - matched;
  return left <= 2 ? `${left} to go. Beat it.` : 'Another go will lock it in.';
}

const nameOf = (r: NoteResult) =>
  r.expectedMidi === null ? '·' : noteName(r.expectedMidi).replace(/-?\d+$/, '');

export function lastResultOf(
  kind: LastResult['kind'],
  results: readonly NoteResult[],
  at: string,
  today: string,
): LastResult | null {
  const { matched, notes: total } = scoreOf(results);
  if (total === 0) return null;
  const targets = results
    .filter((r): r is NoteResult & { targetIndex: number } => r.targetIndex !== null)
    .sort((a, b) => a.targetIndex - b.targetIndex);
  const states = noteStrip(results);
  return {
    kind,
    when: whenLabel(dayKey(new Date(at)), today),
    matched,
    total,
    notes: targets.slice(0, MAX_CHIPS).map((r, i) => ({ name: nameOf(r), state: states[i] })),
    hidden: Math.max(0, total - MAX_CHIPS),
    line: beatLine(matched, total),
  };
}
