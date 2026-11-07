// Phrases: a melody is answered one phrase at a time (a phrase fits in the ear's working memory; a
// whole 60-note tune does not), while the tune itself stays whole. Pure, so the splitting, the clip
// offsets and the roll-up of phrase grades into one grade for the tune are unit-testable.
import { AttemptGrade, DetectedNote, Melody } from '../models';

/** Notes per phrase; a melody without phrase marks is one phrase. */
export function phraseLengths(m: Melody): number[] {
  const marked = m.phrases;
  const total = marked?.reduce((a, b) => a + b, 0);
  return marked && marked.length > 0 && total === m.notes.length ? marked : [m.notes.length];
}

export function phraseCount(m: Melody): number {
  return phraseLengths(m).length;
}

/** Index of the first note of phrase `i` and the index just past its last. */
export function phraseRange(m: Melody, i: number): { start: number; end: number } {
  const lens = phraseLengths(m);
  if (!Number.isInteger(i) || i < 0 || i >= lens.length) {
    throw new Error(`Phrase ${i} is outside 0–${lens.length - 1}.`);
  }
  const start = lens.slice(0, i).reduce((a, b) => a + b, 0);
  return { start, end: start + lens[i] };
}

/**
 * Phrase `i` as a melody of its own: its notes renumbered from 0, so it can be scheduled, answered and
 * graded like any melody. Keeps the tune's id, tempo and scale.
 */
export function phraseMelody(m: Melody, i: number): Melody {
  const { start, end } = phraseRange(m, i);
  return {
    ...m,
    notes: m.notes.slice(start, end).map((n, index) => ({ ...n, index })),
    phrases: [end - start],
  };
}

/** Where phrase `i` starts in the tune, in beats from its first note (for seeking in the tune's clip). */
export function phraseStartBeats(m: Melody, i: number): number {
  const { start } = phraseRange(m, i);
  return m.notes.slice(0, start).reduce((sum, n) => sum + n.durationBeats, 0);
}

/**
 * One grade for the whole tune from the grade of each phrase (each learner's first try at it): note
 * results are renumbered onto the tune, the tune is correct only if every phrase was, and its
 * confidence is the lowest of any phrase.
 */
export function combinePhraseGrades(m: Melody, grades: readonly AttemptGrade[]): AttemptGrade {
  if (grades.length !== phraseCount(m)) {
    throw new Error(`Need a grade for each of ${phraseCount(m)} phrases, got ${grades.length}.`);
  }
  const noteResults = grades.flatMap((g, i) => {
    const { start } = phraseRange(m, i);
    return g.noteResults.map((r) => ({
      ...r,
      targetIndex: r.targetIndex === null ? null : r.targetIndex + start,
    }));
  });
  const confidence = Math.min(...grades.map((g) => g.confidence));
  return {
    noteResults,
    verdict: grades.every((g) => g.verdict === 'correct') ? 'correct' : 'incorrect',
    confidence,
    lowConfidence: grades.some((g) => g.lowConfidence),
    timedOut: grades.every((g) => g.timedOut),
  };
}

/** The detected notes of every phrase's counted try, in tune order. */
export function combinePhraseAnswers(answers: readonly DetectedNote[][]): DetectedNote[] {
  return answers.flat();
}

/** How the tune went, for the closing card: phrases right first time and notes matched. */
export function tuneSummary(grades: readonly AttemptGrade[]): {
  phrasesRight: number;
  phrases: number;
  notesMatched: number;
  notes: number;
} {
  const results = grades.flatMap((g) => g.noteResults);
  return {
    phrasesRight: grades.filter((g) => g.verdict === 'correct').length,
    phrases: grades.length,
    notesMatched: results.filter((r) => r.status === 'matched').length,
    notes: results.filter((r) => r.targetIndex !== null).length,
  };
}
