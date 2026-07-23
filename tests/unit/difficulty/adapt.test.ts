// T036 — difficulty reducer (contracts/difficulty-adaptation.md, FR-011/011a/011b).
// Pure reducer: no IO, no clock, no randomness, so the whole transition table is exercised here.
import { AttemptOutcome, DifficultySettings } from '../../../src/models';
import {
  DEFAULT_DIFFICULTY_SETTINGS,
  MAX_RANK,
  MIN_RANK,
  applyAttempt,
  effectiveRank,
  setFixedRank,
  setMode,
} from '../../../src/features/difficulty/adapt';

/** A settings value with the given overrides applied to the documented defaults. */
function settings(patch: Partial<DifficultySettings> = {}): DifficultySettings {
  return { ...DEFAULT_DIFFICULTY_SETTINGS, ...patch };
}

const CORRECT: AttemptOutcome = {
  verdict: 'correct',
  graded: true,
  isFirstAttemptOnMelody: true,
};
const INCORRECT: AttemptOutcome = { ...CORRECT, verdict: 'incorrect' };

/** Feed a sequence of outcomes through the reducer. */
function feed(start: DifficultySettings, outcomes: AttemptOutcome[]): DifficultySettings {
  return outcomes.reduce(applyAttempt, start);
}

describe('effectiveRank', () => {
  test('adaptive mode reports the adaptive rank', () => {
    expect(effectiveRank(settings({ mode: 'adaptive', adaptiveRank: 5, fixedRank: 2 }))).toBe(5);
  });

  test('fixed mode reports the fixed rank', () => {
    expect(effectiveRank(settings({ mode: 'fixed', adaptiveRank: 5, fixedRank: 2 }))).toBe(2);
  });
});

describe('promotion — 3 consecutive correct (FR-011)', () => {
  test('two correct attempts do not raise the rank', () => {
    const s = feed(settings({ adaptiveRank: 3 }), [CORRECT, CORRECT]);
    expect(s.adaptiveRank).toBe(3);
    expect(s.streakKind).toBe('correct');
    expect(s.streakCount).toBe(2);
  });

  test('the third consecutive correct raises the rank by exactly one', () => {
    const s = feed(settings({ adaptiveRank: 3 }), [CORRECT, CORRECT, CORRECT]);
    expect(s.adaptiveRank).toBe(4);
  });

  test('the counter resets after promotion, so a 4th correct does not double-promote', () => {
    const s = feed(settings({ adaptiveRank: 3 }), [CORRECT, CORRECT, CORRECT, CORRECT]);
    expect(s.adaptiveRank).toBe(4);
    expect(s.streakCount).toBe(1);
  });

  test('a full second streak is required for the next promotion', () => {
    const s = feed(settings({ adaptiveRank: 3 }), Array(6).fill(CORRECT));
    expect(s.adaptiveRank).toBe(5);
  });
});

describe('demotion — 2 consecutive incorrect (FR-011)', () => {
  test('a single incorrect attempt does not lower the rank', () => {
    const s = feed(settings({ adaptiveRank: 3 }), [INCORRECT]);
    expect(s.adaptiveRank).toBe(3);
    expect(s.streakCount).toBe(1);
  });

  test('the second consecutive incorrect lowers the rank by exactly one', () => {
    const s = feed(settings({ adaptiveRank: 3 }), [INCORRECT, INCORRECT]);
    expect(s.adaptiveRank).toBe(2);
    expect(s.streakCount).toBe(0);
  });

  test('demotion is faster than promotion — 2 losses move the rank, 2 wins do not', () => {
    const lost = feed(settings({ adaptiveRank: 4 }), [INCORRECT, INCORRECT]);
    const won = feed(settings({ adaptiveRank: 4 }), [CORRECT, CORRECT]);
    expect(lost.adaptiveRank).toBe(3);
    expect(won.adaptiveRank).toBe(4);
  });
});

describe('streak switching', () => {
  test('a correct attempt mid-incorrect-streak restarts the count at 1', () => {
    const s = feed(settings({ adaptiveRank: 3 }), [INCORRECT, CORRECT]);
    expect(s.streakKind).toBe('correct');
    expect(s.streakCount).toBe(1);
    expect(s.adaptiveRank).toBe(3);
  });

  test('an incorrect attempt mid-correct-streak restarts the count at 1', () => {
    const s = feed(settings({ adaptiveRank: 3 }), [CORRECT, CORRECT, INCORRECT]);
    expect(s.streakKind).toBe('incorrect');
    expect(s.streakCount).toBe(1);
    expect(s.adaptiveRank).toBe(3);
  });

  test('an alternating sequence never moves the rank', () => {
    const s = feed(settings({ adaptiveRank: 4 }), [
      CORRECT,
      INCORRECT,
      CORRECT,
      INCORRECT,
      CORRECT,
    ]);
    expect(s.adaptiveRank).toBe(4);
  });
});

describe('ineligible attempts are invisible to adaptation (FR-011a)', () => {
  const ineligible: [string, AttemptOutcome][] = [
    ['a retry', { ...CORRECT, isFirstAttemptOnMelody: false }],
    ['a low-confidence / ungraded capture', { ...CORRECT, graded: false }],
    ['an incorrect retry', { ...INCORRECT, isFirstAttemptOnMelody: false }],
    ['an ungraded timeout', { ...INCORRECT, graded: false }],
  ];

  test.each(ineligible)('%s leaves the settings byte-identical', (_label, outcome) => {
    const before = settings({ adaptiveRank: 3, streakKind: 'correct', streakCount: 2 });
    expect(applyAttempt(before, outcome)).toEqual(before);
  });

  test('a retry cannot complete a promotion streak', () => {
    const s = feed(settings({ adaptiveRank: 3 }), [
      CORRECT,
      CORRECT,
      { ...CORRECT, isFirstAttemptOnMelody: false },
    ]);
    expect(s.adaptiveRank).toBe(3);
    expect(s.streakCount).toBe(2);
  });

  test('two noisy captures do not demote — the anti-frustration case', () => {
    const before = settings({ adaptiveRank: 5 });
    const s = feed(before, [
      { ...INCORRECT, graded: false },
      { ...INCORRECT, graded: false },
    ]);
    expect(s).toEqual(before);
  });
});

describe('fixed mode never auto-adjusts (US2 #4)', () => {
  test('no outcome sequence moves the adaptive rank while fixed', () => {
    const before = settings({ mode: 'fixed', adaptiveRank: 5, fixedRank: 2 });
    const s = feed(before, [CORRECT, CORRECT, CORRECT, INCORRECT, INCORRECT]);
    expect(s).toEqual(before);
  });
});

describe('clamping at the ladder boundaries', () => {
  test('continued success at the top rank leaves it at the top', () => {
    const s = feed(settings({ adaptiveRank: MAX_RANK }), Array(6).fill(CORRECT));
    expect(s.adaptiveRank).toBe(MAX_RANK);
  });

  test('continued failure at the bottom rank leaves it at the bottom', () => {
    const s = feed(settings({ adaptiveRank: MIN_RANK }), Array(6).fill(INCORRECT));
    expect(s.adaptiveRank).toBe(MIN_RANK);
  });

  test('a clamped streak still resets, so no hidden backlog fires on leaving the boundary', () => {
    // Three correct at the ceiling clamp and reset; one more correct must not immediately promote
    // after a demotion moves the learner off the boundary.
    const atCeiling = feed(settings({ adaptiveRank: MAX_RANK }), [CORRECT, CORRECT, CORRECT]);
    expect(atCeiling.streakCount).toBe(0);
    const afterDrop = feed(atCeiling, [INCORRECT, INCORRECT, CORRECT]);
    expect(afterDrop.adaptiveRank).toBe(MAX_RANK - 1);
  });
});

describe('manual selection preserves adaptive progress (FR-011b)', () => {
  test('setFixedRank does not touch the adaptive rank or the streak', () => {
    const before = settings({ adaptiveRank: 5, streakKind: 'correct', streakCount: 2 });
    const after = setFixedRank(before, 2);
    expect(after.fixedRank).toBe(2);
    expect(after.adaptiveRank).toBe(5);
    expect(after.streakKind).toBe('correct');
    expect(after.streakCount).toBe(2);
  });

  test('the adaptive → fixed → adaptive round-trip restores the effective rank', () => {
    const start = settings({ mode: 'adaptive', adaptiveRank: 5 });
    const toFixed = setMode(setFixedRank(start, 2), 'fixed');
    expect(effectiveRank(toFixed)).toBe(2);
    expect(effectiveRank(setMode(toFixed, 'adaptive'))).toBe(5);
  });

  test('any rank 1–7 may be selected — no unlock gating', () => {
    const start = settings({ adaptiveRank: 1 });
    expect(effectiveRank(setMode(setFixedRank(start, MAX_RANK), 'fixed'))).toBe(MAX_RANK);
  });

  test('setMode changes only the mode', () => {
    const before = settings({
      adaptiveRank: 4,
      fixedRank: 6,
      streakCount: 1,
      streakKind: 'correct',
    });
    expect(setMode(before, 'fixed')).toEqual({ ...before, mode: 'fixed' });
  });
});

describe('purity', () => {
  test('applyAttempt does not mutate its input', () => {
    const before = settings({ adaptiveRank: 3 });
    const snapshot = { ...before };
    applyAttempt(before, CORRECT);
    expect(before).toEqual(snapshot);
  });

  test('the same input always yields the same output', () => {
    const s = settings({ adaptiveRank: 3, streakKind: 'correct', streakCount: 2 });
    expect(applyAttempt(s, CORRECT)).toEqual(applyAttempt(s, CORRECT));
  });
});

describe('error modes', () => {
  test.each([0, 8, -1, 1.5, NaN])('setFixedRank rejects out-of-range rank %p', (rank) => {
    expect(() => setFixedRank(settings(), rank)).toThrow();
  });

  test('a negative streak count in the input state is rejected', () => {
    expect(() => applyAttempt(settings({ streakCount: -1 }), CORRECT)).toThrow();
  });
});

describe('documented defaults (data-model.md)', () => {
  test('a brand-new learner starts adaptive at rank 1 with no streak', () => {
    expect(DEFAULT_DIFFICULTY_SETTINGS).toEqual({
      mode: 'adaptive',
      adaptiveRank: 1,
      fixedRank: 1,
      streakKind: 'none',
      streakCount: 0,
    });
  });
});
