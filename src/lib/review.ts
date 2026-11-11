// Looking back at an answer: the score, and for each note that went wrong what was played and what it
// should have been. Shown only once a tune is finished (its closing card) — while a phrase can still
// be retried the right note stays unnamed, since finding it by ear is the exercise.
// Pure, so the wording and the counting are unit-testable.
import { NoteResult } from '../models';
import { noteName } from './pitchNote';

export interface Mistake {
  kind: 'wrong' | 'missed' | 'extra';
  /** 1-based place of the note in the tune; null for an extra note, which has no place in it. */
  position: number | null;
  /** Note name the learner played; null when the note was missed. */
  played: string | null;
  /** Note name the tune has there; null for an extra note. */
  expected: string | null;
  /** Right note, wrong octave. */
  octave: boolean;
}

export interface Score {
  matched: number;
  /** Notes in the tune (extras do not add to it). */
  notes: number;
  /** 0–100, rounded. */
  pct: number;
}

const name = (midi: number | null) => (midi === null ? null : noteName(midi));

/** Every note that was not matched, in the order of the answer. */
export function mistakesOf(results: readonly NoteResult[]): Mistake[] {
  return results
    .filter((r) => r.status !== 'matched')
    .map((r) => ({
      kind: r.status as Mistake['kind'],
      position: r.targetIndex === null ? null : r.targetIndex + 1,
      played: name(r.detectedMidi),
      expected: name(r.expectedMidi),
      octave: r.octaveMismatch,
    }));
}

export function scoreOf(results: readonly NoteResult[]): Score {
  const notes = results.filter((r) => r.targetIndex !== null).length;
  const matched = results.filter((r) => r.status === 'matched').length;
  return { matched, notes, pct: notes === 0 ? 0 : Math.round((matched / notes) * 100) };
}

/** How a note of the tune went: the three states the note strip draws. */
export type StripNote = 'matched' | 'wrong' | 'missed';

/** The tune note by note in its own order — one state per note; extras have no place in it. */
export function noteStrip(results: readonly NoteResult[]): StripNote[] {
  return results
    .filter((r): r is NoteResult & { targetIndex: number } => r.targetIndex !== null)
    .sort((a, b) => a.targetIndex - b.targetIndex)
    .map((r) => r.status as StripNote);
}

/** A wrong note, short enough for a chip: "5 · G3 → A3" (place · played → right note). */
export function mistakeChip(m: Mistake): string {
  return `${m.position ?? '+'} · ${m.played ?? '–'} → ${m.expected ?? '–'}`;
}

/** The misses in one line, naming only the kinds that happened: "2 wrong · 5 not played". */
export function missSummary(mistakes: readonly Mistake[]): string {
  const count = (kind: Mistake['kind']) => mistakes.filter((m) => m.kind === kind).length;
  const parts = [
    [count('wrong'), 'wrong'],
    [count('missed'), 'not played'],
    [count('extra'), 'extra'],
  ] as const;
  const said = parts.filter(([n]) => n > 0).map(([n, word]) => `${n} ${word}`);
  return said.length === 0 ? 'Every note right' : said.join(' · ');
}

/** The word a finished tune earns. Honest: a rough run is named for what it was, not as a triumph. */
export function praise(pct: number): string {
  if (pct >= 100) return 'Perfect';
  if (pct >= 80) return 'Great job';
  if (pct >= 50) return 'Good ear';
  return 'You played it through';
}
