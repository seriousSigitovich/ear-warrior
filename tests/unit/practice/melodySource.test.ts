// FR-021: the build flag selects where melodies come from. This version ships the curated set; the
// generator is off and only an explicit `generator` brings it back.
import { resolveMelodySource } from '../../../src/features/practice/melodySource';

describe('resolveMelodySource (FR-021)', () => {
  test('defaults to the curated set when the flag is absent', () => {
    expect(resolveMelodySource(undefined)).toBe('curated');
  });

  test('`generator` turns the generator back on', () => {
    expect(resolveMelodySource('generator')).toBe('generator');
  });

  test('anything else, including a typo, stays on the curated set', () => {
    expect(resolveMelodySource('curated')).toBe('curated');
    expect(resolveMelodySource('GENERATOR')).toBe('curated');
    expect(resolveMelodySource('')).toBe('curated');
  });
});
