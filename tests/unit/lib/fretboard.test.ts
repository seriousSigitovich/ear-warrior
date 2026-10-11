import { Melody, Note, NoteResult } from '../../../src/models';
import {
  FRET_COUNT,
  FretTap,
  OPEN_STRING_MIDI,
  STRING_COUNT,
  addTap,
  fretMidi,
  isValidPosition,
  makeTap,
  positionsForMidi,
  tapStatuses,
  tapsToDetected,
  undoTap,
} from '../../../src/lib/fretboard';
import { hzFromMidi } from '../../../src/lib/pitchNote';
import { gradeAttempt } from '../../../src/services/grading/grade';

const GRADING = { centsTolerance: 50, octaveSensitive: true, lowConfidenceThreshold: 0.6 };

function melodyOf(midis: number[]): Melody {
  const notes: Note[] = midis.map((midi, index) => ({
    index,
    midi,
    noteName: '',
    frequencyHz: hzFromMidi(midi),
    centsOffset: 0,
    durationBeats: 1,
  }));
  return { id: 'm', notes, difficultyId: 'L1', scale: 'C', createdAt: '' };
}

const tapAt = (string: number, fret: number, atMs: number): FretTap =>
  makeTap({ string, fret }, atMs);

describe('fretMidi', () => {
  test('open strings are standard tuning E2 A2 D3 G3 B3 E4', () => {
    expect([0, 1, 2, 3, 4, 5].map((string) => fretMidi({ string, fret: 0 }))).toEqual([
      40, 45, 50, 55, 59, 64,
    ]);
  });

  test('each fret adds one semitone', () => {
    expect(fretMidi({ string: 5, fret: 3 })).toBe(67); // G4 on the high e
    expect(fretMidi({ string: 5, fret: 12 })).toBe(76); // E5 — the 12th fret of the high e, top of the neck
  });

  test('rejects positions off the board', () => {
    expect(() => fretMidi({ string: 6, fret: 0 })).toThrow();
    expect(() => fretMidi({ string: 0, fret: 13 })).toThrow(); // the neck ends at the 12th fret
    expect(() => fretMidi({ string: 0, fret: -1 })).toThrow();
    expect(isValidPosition({ string: 2, fret: 1.5 })).toBe(false);
  });
});

describe('positionsForMidi', () => {
  test('lists every string that can sound the pitch, low string first', () => {
    // G3 (55): open G, fret 5 on D, fret 10 on A; the low E would need fret 15, past the 12th.
    expect(positionsForMidi(55)).toEqual([
      { string: 1, fret: 10 },
      { string: 2, fret: 5 },
      { string: 3, fret: 0 },
    ]);
  });

  test('every position round-trips through fretMidi', () => {
    for (let midi = 40; midi <= 76; midi++) {
      const positions = positionsForMidi(midi);
      expect(positions.length).toBeGreaterThan(0);
      for (const p of positions) expect(fretMidi(p)).toBe(midi);
    }
  });

  test('pitches off the board have no position', () => {
    expect(positionsForMidi(39)).toEqual([]);
    expect(positionsForMidi(77)).toEqual([]); // F5 is past the 12th fret of the high e
  });

  test('the board is 12 frets and spans E2–E5, the register MVP melodies must fit', () => {
    expect(FRET_COUNT).toBe(13); // open + frets 1–12
    expect(OPEN_STRING_MIDI[0]).toBe(40);
    expect(fretMidi({ string: STRING_COUNT - 1, fret: FRET_COUNT - 1 })).toBe(76);
  });
});

describe('addTap / undoTap', () => {
  test('stops adding once the melody length is reached', () => {
    let taps: FretTap[] = [];
    taps = addTap(taps, tapAt(5, 0, 0), 2);
    taps = addTap(taps, tapAt(5, 1, 10), 2);
    const full = addTap(taps, tapAt(5, 3, 20), 2);
    expect(full).toBe(taps); // unchanged, same reference
    expect(full).toHaveLength(2);
  });

  test('undo removes the latest tap and is safe on an empty answer', () => {
    const taps = [tapAt(5, 0, 0), tapAt(5, 1, 10)];
    expect(undoTap(taps).map((t) => t.fret)).toEqual([0]);
    expect(undoTap([])).toEqual([]);
  });
});

describe('tapsToDetected', () => {
  test('empty answer yields no notes', () => {
    expect(tapsToDetected([])).toEqual([]);
  });

  test('produces exact, fully clear notes timed relative to the first tap', () => {
    const detected = tapsToDetected([tapAt(5, 3, 5000), tapAt(5, 0, 5400)]);
    expect(detected).toHaveLength(2);
    expect(detected[0]).toMatchObject({
      index: 0,
      midi: 67,
      centsOffset: 0,
      clarity: 1,
      startMs: 0,
      endMs: 400,
    });
    expect(detected[0].frequencyHz).toBeCloseTo(hzFromMidi(67), 6);
    expect(detected[1]).toMatchObject({ index: 1, midi: 64, startMs: 400 });
    expect(detected[1].endMs).toBeGreaterThan(detected[1].startMs);
  });
});

describe('grading a fretboard answer', () => {
  const target = melodyOf([67, 64, 62]); // G4 E4 D4

  test('any position of the right pitch is correct', () => {
    // G4 on the high e (fret 3) vs the B string (fret 8); E4 open vs G string fret 9; D4 on B fret 3.
    const taps = [tapAt(4, 8, 0), tapAt(3, 9, 300), tapAt(4, 3, 600)];
    const grade = gradeAttempt(target, tapsToDetected(taps), GRADING);
    expect(grade.verdict).toBe('correct');
    expect(grade.lowConfidence).toBe(false);
    expect(grade.timedOut).toBe(false);
    expect(grade.confidence).toBe(1);
  });

  test('a wrong pitch is wrong, and the wrong octave is called out', () => {
    // second note an octave low: E3 (52) instead of E4 (64)
    const taps = [tapAt(5, 3, 0), tapAt(1, 7, 300), tapAt(4, 3, 600)];
    const grade = gradeAttempt(target, tapsToDetected(taps), GRADING);
    expect(grade.verdict).toBe('incorrect');
    expect(grade.noteResults[1]).toMatchObject({ status: 'wrong', octaveMismatch: true });
  });

  test('stopping early leaves the remaining notes missed', () => {
    const grade = gradeAttempt(target, tapsToDetected([tapAt(5, 3, 0)]), GRADING);
    expect(grade.noteResults.map((r) => r.status)).toEqual(['matched', 'missed', 'missed']);
    expect(grade.timedOut).toBe(false);
  });
});

describe('tapStatuses', () => {
  const result = (status: NoteResult['status']): NoteResult => ({
    targetIndex: status === 'extra' ? null : 0,
    status,
    expectedMidi: null,
    detectedMidi: null,
    octaveMismatch: false,
  });

  test('drops missed targets so statuses line up with the taps', () => {
    expect(tapStatuses([result('matched'), result('missed'), result('wrong')])).toEqual([
      'matched',
      'wrong',
    ]);
  });

  test('stays aligned with the taps on a real grade', () => {
    const target = melodyOf([60, 62, 64]);
    // played: C, F (wrong), then nothing for E
    const taps = [tapAt(3, 5, 0), tapAt(3, 10, 300)];
    // C4 = midi 60 -> string 3 (G, 55) fret 5; F4 = 65 -> string 3 fret 10
    const grade = gradeAttempt(target, tapsToDetected(taps), GRADING);
    const statuses = tapStatuses(grade.noteResults);
    expect(statuses).toHaveLength(taps.length);
    expect(statuses).toEqual(['matched', 'wrong']);
  });
});
