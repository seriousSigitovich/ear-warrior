import { DetectedNote, GradingConfig, Melody } from '../../../src/models';
import { hzFromMidi, noteName } from '../../../src/lib/pitchNote';
import { gradeAttempt } from '../../../src/services/grading/grade';

const CFG: GradingConfig = {
  centsTolerance: 50,
  octaveSensitive: true,
  lowConfidenceThreshold: 0.6,
};

function melody(midis: number[]): Melody {
  return {
    id: 't',
    difficultyId: 'L',
    scale: 'test',
    createdAt: '',
    notes: midis.map((midi, index) => ({
      index,
      midi,
      noteName: noteName(midi),
      frequencyHz: hzFromMidi(midi),
      centsOffset: 0,
      durationBeats: 1,
    })),
  };
}

function detected(midis: number[], clarity: number | number[] = 0.9): DetectedNote[] {
  return midis.map((midi, index) => ({
    index,
    midi,
    frequencyHz: hzFromMidi(midi),
    centsOffset: 0,
    clarity: Array.isArray(clarity) ? clarity[index] : clarity,
    startMs: index * 100,
    endMs: index * 100 + 80,
  }));
}

const countStatus = (g: ReturnType<typeof gradeAttempt>, s: string) =>
  g.noteResults.filter((r) => r.status === s).length;

describe('grading engine (FR-005, FR-016, FR-017)', () => {
  test('exact match → correct, all matched, confidence = min clarity', () => {
    const g = gradeAttempt(melody([60, 62, 64]), detected([60, 62, 64], [0.9, 0.7, 0.8]), CFG);
    expect(g.verdict).toBe('correct');
    expect(countStatus(g, 'matched')).toBe(3);
    expect(g.confidence).toBeCloseTo(0.7, 5); // minimum per-note clarity
    expect(g.lowConfidence).toBe(false);
    expect(g.timedOut).toBe(false);
  });

  test('one wrong note → incorrect with a single wrong', () => {
    const g = gradeAttempt(melody([60, 62, 64]), detected([60, 63, 64]), CFG);
    expect(g.verdict).toBe('incorrect');
    expect(countStatus(g, 'wrong')).toBe(1);
    expect(countStatus(g, 'matched')).toBe(2);
  });

  test('a skipped note → missed', () => {
    const g = gradeAttempt(melody([60, 62, 64]), detected([60, 64]), CFG);
    expect(countStatus(g, 'missed')).toBe(1);
    expect(countStatus(g, 'matched')).toBe(2);
    expect(g.verdict).toBe('incorrect');
  });

  test('an inserted note → extra', () => {
    const g = gradeAttempt(melody([60, 62, 64]), detected([60, 62, 63, 64]), CFG);
    expect(countStatus(g, 'extra')).toBe(1);
    expect(countStatus(g, 'matched')).toBe(3);
    expect(g.verdict).toBe('incorrect');
  });

  test('a mid-phrase insertion does NOT cascade the surrounding notes to wrong (FR-005)', () => {
    // target A B C D, played A X B C D
    const g = gradeAttempt(melody([60, 62, 64, 65]), detected([60, 61, 62, 64, 65]), CFG);
    expect(countStatus(g, 'matched')).toBe(4);
    expect(countStatus(g, 'extra')).toBe(1);
    expect(countStatus(g, 'wrong')).toBe(0);
  });

  test('a mid-phrase omission does NOT cascade (FR-005)', () => {
    // target A B C D, played A C D
    const g = gradeAttempt(melody([60, 62, 64, 65]), detected([60, 64, 65]), CFG);
    expect(countStatus(g, 'matched')).toBe(3);
    expect(countStatus(g, 'missed')).toBe(1);
    expect(countStatus(g, 'wrong')).toBe(0);
  });

  test('correct pitch class in the wrong octave → wrong + octaveMismatch (octaveSensitive)', () => {
    const g = gradeAttempt(melody([64]), detected([76]), CFG); // E4 vs E5
    expect(g.noteResults[0].status).toBe('wrong');
    expect(g.noteResults[0].octaveMismatch).toBe(true);
    expect(g.verdict).toBe('incorrect');
  });

  test('empty input → timedOut, low confidence, not a normal incorrect grade', () => {
    const g = gradeAttempt(melody([60, 62]), detected([]), CFG);
    expect(g.timedOut).toBe(true);
    expect(g.confidence).toBe(0);
    expect(g.lowConfidence).toBe(true);
    expect(countStatus(g, 'missed')).toBe(2);
  });

  test('minimum per-note clarity below threshold flags low confidence (FR-017)', () => {
    const g = gradeAttempt(melody([60, 62]), detected([60, 62], [0.9, 0.4]), CFG);
    expect(g.confidence).toBeCloseTo(0.4, 5);
    expect(g.lowConfidence).toBe(true);
  });
});
