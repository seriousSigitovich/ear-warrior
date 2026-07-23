// T065 — deriving the adaptation input from a grade (FR-011a, Constitution II).
// This rule used to live inline in the React hook, where no test could reach it; it decides whether
// an attempt is visible to the difficulty streak at all.
import { AttemptGrade } from '../../../src/models';
import { toAttemptOutcome } from '../../../src/features/difficulty/adapt';

function grade(patch: Partial<AttemptGrade> = {}): AttemptGrade {
  return {
    noteResults: [],
    verdict: 'correct',
    confidence: 0.9,
    lowConfidence: false,
    timedOut: false,
    ...patch,
  };
}

describe('toAttemptOutcome — graded flag (FR-011a)', () => {
  test('a clean grade is graded', () => {
    expect(toAttemptOutcome(grade(), false).graded).toBe(true);
  });

  test('a timed-out attempt is not graded', () => {
    expect(toAttemptOutcome(grade({ timedOut: true }), false).graded).toBe(false);
  });

  test('a low-confidence capture is not graded', () => {
    expect(toAttemptOutcome(grade({ lowConfidence: true }), false).graded).toBe(false);
  });

  test('both flags together are still not graded', () => {
    expect(toAttemptOutcome(grade({ timedOut: true, lowConfidence: true }), false).graded).toBe(
      false,
    );
  });
});

describe('toAttemptOutcome — first-attempt flag (FR-011a)', () => {
  test('the first attempt on a fresh melody is the first attempt', () => {
    expect(toAttemptOutcome(grade(), false).isFirstAttemptOnMelody).toBe(true);
  });

  test('an attempt after a graded one is a retry', () => {
    expect(toAttemptOutcome(grade(), true).isFirstAttemptOnMelody).toBe(false);
  });

  test('an attempt following an ungraded one is still the first GRADED attempt', () => {
    // The loop only records "has graded this melody" after a graded attempt, so a capture that
    // timed out must not consume the learner's one first-attempt chance.
    const afterTimeout = toAttemptOutcome(grade({ timedOut: true }), false);
    expect(afterTimeout.isFirstAttemptOnMelody).toBe(true);
    expect(afterTimeout.graded).toBe(false);
  });
});

describe('toAttemptOutcome — verdict passthrough', () => {
  test.each(['correct', 'incorrect'] as const)('carries the %s verdict unchanged', (verdict) => {
    expect(toAttemptOutcome(grade({ verdict }), false).verdict).toBe(verdict);
  });
});

describe('toAttemptOutcome — purity', () => {
  test('does not mutate the grade', () => {
    const g = grade();
    const snapshot = { ...g };
    toAttemptOutcome(g, false);
    expect(g).toEqual(snapshot);
  });
});
