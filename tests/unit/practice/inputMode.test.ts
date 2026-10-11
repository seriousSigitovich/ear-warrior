// FR-020: the build flag selects the answer mode. The MVP default is the fretboard; only an explicit
// `mic` restores the microphone pipeline.
import { resolveInputMode } from '../../../src/features/practice/inputMode';

describe('resolveInputMode (FR-020)', () => {
  test('defaults to the fretboard when the flag is absent', () => {
    expect(resolveInputMode(undefined)).toBe('fretboard');
  });

  test('`mic` restores the microphone pipeline', () => {
    expect(resolveInputMode('mic')).toBe('mic');
  });

  test('anything else, including a typo, falls back to the fretboard', () => {
    expect(resolveInputMode('fretboard')).toBe('fretboard');
    expect(resolveInputMode('MIC')).toBe('fretboard');
    expect(resolveInputMode('')).toBe('fretboard');
  });
});
