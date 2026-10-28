// Guards the first batch of library candidates: playable on the 12-fret neck, inside the declared
// key (a typo shows up as a note outside it), inside the planned note range, and public domain by
// the rule written at the top of candidates.ts. Wrong notes INSIDE the key need an ear, not a test.
import { CANDIDATES } from '../../../src/services/melody/candidates';
import { bandOf, classify, parseMelody } from '../../../src/services/melody/classify';
import { CURATED } from '../../../src/services/melody/curated';
import { scalePitchClasses } from '../../../src/services/melody/scales';
import { MAX_FRET, OPEN_STRING_MIDI, positionsForMidi } from '../../../src/lib/fretboard';
import { pitchClass } from '../../../src/lib/pitchNote';

const NECK_LOW = OPEN_STRING_MIDI[0];
const NECK_HIGH = OPEN_STRING_MIDI[OPEN_STRING_MIDI.length - 1] + MAX_FRET;

describe('library candidates', () => {
  test('ids are unique, hyphen-free, and do not collide with the curated set', () => {
    const ids = CANDIDATES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).not.toContain('-');
    const curated = new Set(CURATED.map((t) => t.id));
    expect(ids.filter((id) => curated.has(id))).toEqual([]);
  });

  test('no two candidates have the same pitch sequence', () => {
    const seen = new Map<string, string>();
    for (const c of CANDIDATES) {
      const key = parseMelody(c.notes)
        .map((n) => n.midi)
        .join(',');
      expect({ id: c.id, sameAs: seen.get(key) }).toEqual({ id: c.id, sameAs: undefined });
      seen.set(key, c.id);
    }
  });

  test('every melody has 3–16 notes', () => {
    for (const c of CANDIDATES) {
      const count = parseMelody(c.notes).length;
      expect({ id: c.id, band: bandOf(count) !== undefined }).toEqual({ id: c.id, band: true });
    }
  });

  test('every note lies on the neck (E2–E5) and can be tapped', () => {
    for (const c of CANDIDATES) {
      for (const { midi } of parseMelody(c.notes)) {
        expect(midi).toBeGreaterThanOrEqual(NECK_LOW);
        expect(midi).toBeLessThanOrEqual(NECK_HIGH);
        expect(positionsForMidi(midi).length).toBeGreaterThan(0);
      }
    }
  });

  test('every note belongs to the tune’s declared key', () => {
    for (const c of CANDIDATES) {
      const held = scalePitchClasses(c.scale);
      for (const { midi } of parseMelody(c.notes)) {
        expect({ id: c.id, midi, inKey: held.includes(pitchClass(midi)) }).toEqual({
          id: c.id,
          midi,
          inKey: true,
        });
      }
    }
  });

  test('a chromatic key is declared exactly when the notes are chromatic', () => {
    for (const c of CANDIDATES) {
      const base = classify(parseMelody(c.notes).map((n) => n.midi)).base;
      expect({ id: c.id, chromaticKey: c.scale.endsWith('_chromatic') }).toEqual({
        id: c.id,
        chromaticKey: base === 'chromatic',
      });
    }
  });

  test('public domain: composer dead by 1955 and published by 1930', () => {
    for (const c of CANDIDATES) {
      if (c.composer === undefined) {
        expect({ id: c.id, died: c.died, year: c.year }).toEqual({
          id: c.id,
          died: undefined,
          year: undefined,
        });
        continue;
      }
      expect({ id: c.id, ok: c.died !== undefined && c.died <= 1955 }).toEqual({ id: c.id, ok: true });
      expect({ id: c.id, ok: c.year !== undefined && c.year <= 1930 }).toEqual({ id: c.id, ok: true });
    }
  });
});
