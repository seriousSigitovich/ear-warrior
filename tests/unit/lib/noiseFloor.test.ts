// Tier 1 noise robustness: the adaptive voicing threshold calibrated from a capture's ambient clarity.
// Covers the quiet-room, noisy-room, and very-noisy cases, the safe fallback, and one end-to-end check
// that segmentation with the adaptive gate rejects background that a fixed 0.5 gate would admit.
import { PitchFrame, SegmentConfig } from '../../../src/models';
import {
  DEFAULT_CALIBRATION_CONFIG,
  adaptiveClarityThreshold,
  estimateAmbientClarity,
  percentile,
} from '../../../src/lib/noiseFloor';
import { segmentFrames } from '../../../src/lib/segment';

const CFG = DEFAULT_CALIBRATION_CONFIG;

function frames(specs: { clarity: number; hz?: number; count: number }[]): PitchFrame[] {
  const out: PitchFrame[] = [];
  let t = 0;
  for (const s of specs) {
    for (let i = 0; i < s.count; i++) {
      out.push({ hz: s.hz ?? 0, clarity: s.clarity, timestampMs: t });
      t += 10;
    }
  }
  return out;
}

describe('percentile', () => {
  test('nearest-rank at the ends and middle', () => {
    expect(percentile([0, 0.5, 1], 0)).toBe(0);
    expect(percentile([0, 0.5, 1], 1)).toBe(1);
    expect(percentile([0, 0.5, 1], 0.5)).toBe(0.5);
    expect(percentile([], 0.5)).toBe(0); // empty guard
  });
  test('is order-independent', () => {
    expect(percentile([1, 0, 0.5], 0.2)).toBe(percentile([0.5, 1, 0], 0.2));
  });
});

describe('adaptiveClarityThreshold', () => {
  test('too few frames → midpoint fallback == the old fixed 0.5', () => {
    expect(adaptiveClarityThreshold(frames([{ clarity: 0.1, count: 5 }]), CFG)).toBeCloseTo(0.5, 5);
  });

  test('quiet room → clamps down to hardMin, catching a weak source', () => {
    // 30 near-silent frames + 10 loud note frames; ambient ≈ 0.1, +0.15 = 0.25 → clamped up to 0.3.
    const f = frames([
      { clarity: 0.1, count: 30 },
      { clarity: 0.9, hz: 440, count: 10 },
    ]);
    expect(estimateAmbientClarity(f, CFG)).toBeCloseTo(0.1, 5);
    expect(adaptiveClarityThreshold(f, CFG)).toBeCloseTo(CFG.hardMin, 5); // 0.3
  });

  test('noisy room → threshold sits margin above the noise floor', () => {
    // 25 noise frames at 0.42 + 15 note frames at 0.8; ambient ≈ 0.42 → 0.42 + 0.15 = 0.57.
    const f = frames([
      { clarity: 0.42, hz: 200, count: 25 },
      { clarity: 0.8, hz: 440, count: 15 },
    ]);
    expect(adaptiveClarityThreshold(f, CFG)).toBeCloseTo(0.57, 5);
  });

  test('very noisy room → clamps up to hardMax so a real note stays reachable', () => {
    const f = frames([{ clarity: 0.75, hz: 200, count: 40 }]);
    expect(adaptiveClarityThreshold(f, CFG)).toBeCloseTo(CFG.hardMax, 5); // 0.7, not 0.9
  });
});

describe('adaptive gate end-to-end with segmentation', () => {
  const SEG: SegmentConfig = {
    clarityThreshold: 0.5, // the OLD fixed gate
    minNoteMs: 60,
    gapMs: 200,
    minHz: 80,
    maxHz: 1320,
    onsetConfirmFrames: 3,
    attackGuardMs: 40,
  };

  // A realistic NOISY room: a steady background (clarity 0.5, ~200 Hz) present the whole time — in the
  // lead-in AND the tail, because a noisy room has no true silence — with one clearly louder real note
  // (A4, clarity 0.85) in the middle. The background clarity is exactly at the old fixed gate.
  const noisy = frames([
    { clarity: 0.5, hz: 200, count: 15 }, // room noise before the note
    { clarity: 0.85, hz: 440, count: 20 }, // the real note (A4 = 440 Hz)
    { clarity: 0.5, hz: 200, count: 15 }, // room noise after the note (no silence in a noisy room)
  ]);

  test('fixed 0.5 gate admits the room noise as spurious notes', () => {
    // Noise (0.5) clears the fixed gate, so the 200 Hz lead-in, the real note, and the 200 Hz tail
    // each segment into a "note": 3 total, two of them phantom.
    expect(segmentFrames(noisy, SEG).length).toBe(3);
  });

  test('adaptive gate calibrates above the noise floor and keeps only the real note', () => {
    const clarityThreshold = adaptiveClarityThreshold(noisy, CFG); // ambient ≈ 0.5 → 0.5 + 0.15 = 0.65
    expect(clarityThreshold).toBeCloseTo(0.65, 5);

    const notes = segmentFrames(noisy, { ...SEG, clarityThreshold });
    expect(notes.length).toBe(1); // the 0.5 noise is now below the gate → gone
    expect(notes[0].midi).toBe(69); // A4 — the real note survives
  });
});
