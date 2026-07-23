import {
  A4_HZ,
  GUITAR_MAX_MIDI,
  GUITAR_MIN_MIDI,
  centsFromHz,
  hzFromMidi,
  isInGuitarRange,
  midiFromHz,
  nearestNote,
  noteName,
} from '../../../src/lib/pitchNote';

describe('pitch ↔ note math (FR-016, A4 = 440 Hz)', () => {
  test('reference: A4 is MIDI 69 at 440 Hz', () => {
    expect(A4_HZ).toBe(440);
    expect(hzFromMidi(69)).toBeCloseTo(440, 5);
    expect(midiFromHz(440)).toBe(69);
  });

  test('hzFromMidi matches equal-temperament frequencies', () => {
    expect(hzFromMidi(64)).toBeCloseTo(329.6276, 2); // E4
    expect(hzFromMidi(60)).toBeCloseTo(261.6256, 2); // C4
  });

  test('midiFromHz rounds to the nearest note', () => {
    expect(midiFromHz(329.63)).toBe(64);
    expect(midiFromHz(261.63)).toBe(60);
  });

  test('noteName derives from MIDI', () => {
    expect(noteName(69)).toBe('A4');
    expect(noteName(60)).toBe('C4');
    expect(noteName(GUITAR_MIN_MIDI)).toBe('E2');
    expect(noteName(GUITAR_MAX_MIDI)).toBe('E6');
  });

  test('centsFromHz reports signed deviation from the nearest note', () => {
    const sharp30 = 440 * Math.pow(2, 30 / 1200); // 30 cents above A4
    expect(centsFromHz(sharp30)).toBeCloseTo(30, 1);
    const flat20 = 440 * Math.pow(2, -20 / 1200);
    expect(centsFromHz(flat20)).toBeCloseTo(-20, 1);
  });

  test('nearest-note quantization: within ±50 cents keeps the note, beyond flips to the adjacent semitone', () => {
    const e4 = hzFromMidi(64);
    const just_inside = e4 * Math.pow(2, 49 / 1200); // +49 cents
    const just_outside = e4 * Math.pow(2, 51 / 1200); // +51 cents → nearer F4
    expect(nearestNote(just_inside).midi).toBe(64);
    expect(nearestNote(just_outside).midi).toBe(65);
    expect(Math.abs(nearestNote(just_inside).centsOffset)).toBeLessThanOrEqual(50);
  });

  test('isInGuitarRange guards E2–E6 (MIDI 40–88)', () => {
    expect(isInGuitarRange(39)).toBe(false);
    expect(isInGuitarRange(40)).toBe(true);
    expect(isInGuitarRange(88)).toBe(true);
    expect(isInGuitarRange(89)).toBe(false);
  });
});
