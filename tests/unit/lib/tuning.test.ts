import { DetectedNote, TuningConfig } from '../../../src/models';
import { hzFromMidi } from '../../../src/lib/pitchNote';
import { detectConsistentDetune } from '../../../src/lib/tuning';

const CFG: TuningConfig = { centsThreshold: 35, minNotes: 3 };

function notes(centsOffsets: number[]): DetectedNote[] {
  return centsOffsets.map((centsOffset, index) => ({
    index,
    midi: 64,
    frequencyHz: hzFromMidi(64),
    centsOffset,
    clarity: 0.9,
    startMs: index * 100,
    endMs: index * 100 + 80,
  }));
}

describe('systematic-detune detection (FR-014)', () => {
  test('a systematic sharp offset above threshold warns (sharp)', () => {
    const w = detectConsistentDetune(notes([40, 42, 38, 41]), CFG);
    expect(w.outOfTune).toBe(true);
    expect(w.direction).toBe('sharp');
    expect(w.medianCents).toBeGreaterThan(35);
  });

  test('a systematic flat offset above threshold warns (flat)', () => {
    const w = detectConsistentDetune(notes([-40, -44, -38, -41]), CFG);
    expect(w.outOfTune).toBe(true);
    expect(w.direction).toBe('flat');
  });

  test('a single sharp note among in-tune notes does NOT warn', () => {
    const w = detectConsistentDetune(notes([60, 2, -3, 1]), CFG);
    expect(w.outOfTune).toBe(false);
  });

  test('offsets that cancel across directions do NOT warn', () => {
    const w = detectConsistentDetune(notes([40, -40, 38, -42]), CFG);
    expect(w.outOfTune).toBe(false);
  });

  test('just under the threshold does NOT warn', () => {
    const w = detectConsistentDetune(notes([30, 30, 30, 30]), CFG);
    expect(w.outOfTune).toBe(false);
  });

  test('fewer than minNotes → no warning (insufficient evidence)', () => {
    const w = detectConsistentDetune(notes([50, 50]), CFG);
    expect(w.outOfTune).toBe(false);
    expect(w.direction).toBe('none');
  });
});
