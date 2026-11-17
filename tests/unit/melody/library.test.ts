// FR-021: the melodies are a library of 100 whole public-domain tunes. These tests guard the library data itself (the
// server's seed, built from library.abc) — every tune must be answerable on the 12-fret neck, belong to its scale,
// appear once, carry its own tempo, and every difficulty level must hold a fair share of the tunes.
import { TUNES } from '../../../server/src/tunes/library.data';
import { parseNotes } from '../../../server/src/tunes/notes';
import { MAX_RANK, MIN_RANK } from '../../../src/services/melody/levels';
import { scalePitchClasses } from '../../../src/services/melody/scales';
import { MAX_FRET, OPEN_STRING_MIDI, positionsForMidi } from '../../../src/lib/fretboard';
import { pitchClass } from '../../../src/lib/pitchNote';

const NECK_LOW = OPEN_STRING_MIDI[0];
const NECK_HIGH = OPEN_STRING_MIDI[OPEN_STRING_MIDI.length - 1] + MAX_FRET;
const RANKS = Array.from({ length: MAX_RANK - MIN_RANK + 1 }, (_, i) => MIN_RANK + i);
const midis = (notes: string) => parseNotes(notes)!.map((n) => n.midi);

describe('melody library data (FR-021)', () => {
  test('tune ids are unique and hyphen-free', () => {
    const ids = TUNES.map((t) => t.id);
    for (const id of ids) expect(id).not.toContain('-');
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('the library holds 100 tunes, none of them twice', () => {
    expect(TUNES).toHaveLength(100);
    expect(new Set(TUNES.map((t) => t.title)).size).toBe(TUNES.length);
    // The same melody under two names (Twinkle / ABC Song) shows up as the same opening intervals.
    const openings = TUNES.map((t) => {
      const m = midis(t.notes);
      return m
        .slice(1, 9)
        .map((x, i) => x - m[i])
        .join(',');
    });
    expect(new Set(openings).size).toBe(TUNES.length);
  });

  test.each(RANKS)('level %i holds 11 or 12 tunes', (rank) => {
    const n = TUNES.filter((t) => t.rank === rank).length;
    expect(n).toBeGreaterThanOrEqual(11);
    expect(n).toBeLessThanOrEqual(12);
  });

  test('every tune is a whole melody with its own tempo and a named source', () => {
    for (const t of TUNES) {
      expect({ tune: t.id, long: midis(t.notes).length >= 15 }).toEqual({ tune: t.id, long: true });
      expect(t.tempoBpm).toBeGreaterThanOrEqual(40);
      expect(t.tempoBpm).toBeLessThanOrEqual(220);
      expect(t.source.length).toBeGreaterThan(0);
    }
  });

  test('tunes do not share one tempo', () => {
    expect(new Set(TUNES.map((t) => t.tempoBpm)).size).toBeGreaterThan(10);
  });

  test('every note lies on the neck (E2–E5) and has a position to tap', () => {
    for (const t of TUNES) {
      for (const midi of midis(t.notes)) {
        expect(midi).toBeGreaterThanOrEqual(NECK_LOW);
        expect(midi).toBeLessThanOrEqual(NECK_HIGH);
        expect(positionsForMidi(midi).length).toBeGreaterThan(0);
      }
    }
  });

  test('every note belongs to its tune’s scale', () => {
    for (const t of TUNES) {
      const pcs = scalePitchClasses(t.scale);
      for (const midi of midis(t.notes)) {
        expect({ tune: t.id, midi, inScale: pcs.includes(pitchClass(midi)) }).toEqual({
          tune: t.id,
          midi,
          inScale: true,
        });
      }
    }
  });
});
