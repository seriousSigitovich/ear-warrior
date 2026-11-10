// Looking back at an answer: the score, and for each note that went wrong what was played and what it
// should have been. Shown only once a tune is finished (its closing card, the Progress history) — while
// a phrase can still be retried the right note stays unnamed, since finding it by ear is the exercise.
// Pure, so the wording and the counting are unit-testable.
import { Attempt, Melody, NoteResult } from '../models';
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

/** One mistake as a sentence: "Note 5: you played G3, it was A3". */
export function mistakeLine(m: Mistake): string {
  if (m.kind === 'extra') return `Extra note: ${m.played ?? '?'}`;
  const where = `Note ${m.position}`;
  if (m.kind === 'missed') return `${where}: not played, it was ${m.expected ?? '?'}`;
  const octave = m.octave ? ' (right note, wrong octave)' : '';
  return `${where}: you played ${m.played ?? '?'}, it was ${m.expected ?? '?'}${octave}`;
}

/** The word a finished tune earns. Honest: a rough run is named for what it was, not as a triumph. */
export function praise(pct: number): string {
  if (pct >= 100) return 'Perfect';
  if (pct >= 80) return 'Great job';
  if (pct >= 50) return 'Good ear';
  return 'You played it through';
}

export interface AttemptReview {
  attemptId: string;
  title: string;
  /** ISO time the tune was finished. */
  at: string;
  score: Score;
  mistakes: Mistake[];
}

/** The latest finished tunes, newest first, each with its score and mistakes. */
export function recentReviews(
  attempts: readonly Attempt[],
  melodies: readonly Pick<Melody, 'id' | 'title'>[],
  limit = 10,
): AttemptReview[] {
  const titles = new Map(melodies.map((m) => [m.id, m.title]));
  return [...attempts]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((a) => ({
      attemptId: a.id,
      title: titles.get(a.melodyId) ?? 'Melody',
      at: a.createdAt,
      score: scoreOf(a.noteResults),
      mistakes: mistakesOf(a.noteResults),
    }));
}
