// The last result Home shows (spec 023): how the last answered phrase of the melody being continued went, or else
// how the latest finished attempt went, note by note. Pure.
import type { Attempt, NoteResult } from '../models';
import { noteName } from './pitchNote';
import { scoreOf, noteStrip, StripNote } from './review';
import { dayKey, shiftDay } from './streak';

/** Notes drawn as chips; a longer result says how many more there were. */
export const MAX_CHIPS = 16;

export interface LastResult {
  /** "Last phrase" (the melody being continued) or "Last attempt" (a finished melody). */
  kind: 'Last phrase' | 'Last attempt';
  /** The melody's name, when the result is of another melody than the one on screen. */
  title: string | null;
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

function summary(
  kind: LastResult['kind'],
  results: readonly NoteResult[],
  at: string,
  today: string,
  title: string | null = null,
): LastResult | null {
  const { matched, notes: total } = scoreOf(results);
  if (total === 0) return null;
  const targets = results
    .filter((r): r is NoteResult & { targetIndex: number } => r.targetIndex !== null)
    .sort((a, b) => a.targetIndex - b.targetIndex);
  const states = noteStrip(results);
  return {
    kind,
    title,
    when: whenLabel(dayKey(new Date(at)), today),
    matched,
    total,
    notes: targets.slice(0, MAX_CHIPS).map((r, i) => ({ name: nameOf(r), state: states[i] })),
    hidden: Math.max(0, total - MAX_CHIPS),
    line: beatLine(matched, total),
  };
}

/**
 * The phrase last answered in the melody being continued (`phrase`: its results and the time), else the latest
 * finished attempt of any melody (named by `titleOf` when given, so it is not taken for the melody on screen); null
 * when there is neither.
 */
export function lastResult(
  phrase: { results: readonly NoteResult[]; at: string } | null,
  attempts: readonly Pick<Attempt, 'createdAt' | 'noteResults' | 'melodyId'>[],
  today: string,
  titleOf?: (melodyId: string) => string | null,
): LastResult | null {
  const fromPhrase = phrase ? summary('Last phrase', phrase.results, phrase.at, today) : null;
  if (fromPhrase) return fromPhrase;
  const latest = [...attempts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  return latest
    ? summary(
        'Last attempt',
        latest.noteResults,
        latest.createdAt,
        today,
        titleOf?.(latest.melodyId) ?? null,
      )
    : null;
}
