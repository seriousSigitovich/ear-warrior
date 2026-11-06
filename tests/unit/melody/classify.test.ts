// The classifier decides a melody's base and shape from its notes alone, so these tests pin the
// boundaries between the three bases with tunes whose answer is known.
import { classify, fitToNeck, parseMelody } from '../../../src/services/melody/classify';

function classifyTokens(notes: string) {
  return classify(parseMelody(notes).map((n) => n.midi));
}

describe('parseMelody', () => {
  test('reads pitch:beats tokens into MIDI numbers', () => {
    expect(parseMelody('C4:1 A4:0.5 Bb3:2 F#5:1')).toEqual([
      { midi: 60, beats: 1 },
      { midi: 69, beats: 0.5 },
      { midi: 58, beats: 2 },
      { midi: 78, beats: 1 },
    ]);
  });

  test.each(['H4:1', 'C4', 'C4:0', 'E#4:1', 'C:1'])('rejects the malformed token %s', (token) => {
    expect(() => parseMelody(token)).toThrow(/Bad note token/);
  });
});

describe('classify: base', () => {
  test('a tune inside one pentatonic scale is pentatonic', () => {
    const c = classifyTokens('E4:1 D4:1 C4:2');
    expect(c.base).toBe('pentatonic');
    expect(c.scales).toContain('C_major_pentatonic');
    expect(c.scales).toContain('A_minor_pentatonic');
  });

  test('a semitone between two notes rules out a pentatonic', () => {
    expect(classifyTokens('E4:1 F4:1 G4:1').base).toBe('diatonic');
  });

  test('a tune that needs 6 or 7 notes of one key is diatonic', () => {
    const c = classifyTokens('E4:1 E4:1 F4:1 G4:1 G4:1 F4:1 E4:1 D4:2');
    expect(c.base).toBe('diatonic');
    expect(c.scales).toContain('C_major');
    expect(c.scales).toContain('A_natural_minor');
  });

  test('every mode of the major scale is diatonic (Dorian included)', () => {
    // D Dorian: D E F G A B C
    expect(classifyTokens('D4:1 E4:1 F4:1 G4:1 A4:1 B4:1 C5:1').base).toBe('diatonic');
  });

  test('a raised seventh still counts as minor, not chromatic', () => {
    const c = classifyTokens('A4:1 G4:1 A4:1 G4:1 F4:1 E4:1 D4:1 C#4:1 D4:1');
    expect(c.base).toBe('diatonic');
    expect(c.scales).toEqual(['D_harmonic_minor']);
  });

  test('notes that need more than one key are chromatic', () => {
    const c = classifyTokens('E5:1 D#5:1 E5:1 D#5:1 E5:1 B4:1 D5:1 C5:1 A4:1');
    expect(c.base).toBe('chromatic');
    expect(c.scales).toEqual([]);
  });

  test('two neighbouring notes can still fit one key', () => {
    expect(classifyTokens('E5:1 D#5:1 E5:1').base).toBe('diatonic');
  });

  test('throws on an empty melody', () => {
    expect(() => classify([])).toThrow();
  });
});

describe('classify: shape', () => {
  test('counts every note, repeats included', () => {
    expect(classifyTokens('E4:1 E4:1 E4:2').noteCount).toBe(3);
  });

  test('measures the largest leap and the range in semitones', () => {
    const c = classifyTokens('C4:1 G4:1 E4:1 C5:1');
    expect(c.maxLeap).toBe(8);
    expect(c.range).toBe(12);
  });
});

describe('fitToNeck', () => {
  test('leaves a melody that already fits alone', () => {
    expect(fitToNeck([60, 64, 67])).toEqual([60, 64, 67]);
  });

  test('moves a melody down or up by whole octaves, as little as possible', () => {
    expect(fitToNeck([69, 81])).toEqual([57, 69]); // A5 is above E5
    expect(fitToNeck([28, 40])).toEqual([40, 52]); // E1 is below E2
  });

  test('gives up when the range is wider than the neck', () => {
    expect(fitToNeck([40, 77])).toBeUndefined();
  });
});
