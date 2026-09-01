import { PitchFrame, SegmentConfig } from '../../../src/models';
import { hzFromMidi } from '../../../src/lib/pitchNote';
import { segmentFrames } from '../../../src/lib/segment';

const CFG: SegmentConfig = {
  clarityThreshold: 0.5,
  minNoteMs: 60,
  gapMs: 120,
  minHz: 80,
  maxHz: 1320,
  onsetConfirmFrames: 3,
  attackGuardMs: 40,
};

/** Build a run of voiced frames at 20 ms cadence for a given MIDI note. */
function voiced(midi: number, startMs: number, count: number, clarity = 0.9): PitchFrame[] {
  const hz = hzFromMidi(midi);
  return Array.from({ length: count }, (_, i) => ({
    hz,
    clarity,
    timestampMs: startMs + i * 20,
  }));
}

function silence(startMs: number, count: number): PitchFrame[] {
  return Array.from({ length: count }, (_, i) => ({
    hz: 0,
    clarity: 0,
    timestampMs: startMs + i * 20,
  }));
}

describe('pitch-stream segmentation (FR-004, R3)', () => {
  test('two sustained pitches separated by a silence gap → two notes', () => {
    const frames = [
      ...voiced(64, 0, 5), // E4, 0–80 ms
      ...silence(100, 8), // 140 ms silence > gapMs
      ...voiced(69, 260, 5), // A4
    ];
    const notes = segmentFrames(frames, CFG);
    expect(notes.map((n) => n.midi)).toEqual([64, 69]);
    expect(notes[0].index).toBe(0);
    expect(notes[1].index).toBe(1);
  });

  test('a pitch change with no gap still splits into two notes', () => {
    const frames = [...voiced(64, 0, 5), ...voiced(67, 100, 5)]; // E4 then G4, contiguous
    const notes = segmentFrames(frames, CFG);
    expect(notes.map((n) => n.midi)).toEqual([64, 67]);
  });

  test('low-clarity frames are treated as silence and yield no note', () => {
    const frames = voiced(64, 0, 6, 0.2); // below clarityThreshold
    expect(segmentFrames(frames, CFG)).toHaveLength(0);
  });

  test('a blip shorter than minNoteMs is dropped', () => {
    const frames = [
      ...voiced(64, 0, 2), // 20 ms < 60 ms
      ...silence(60, 8),
      ...voiced(69, 260, 5),
    ];
    expect(segmentFrames(frames, CFG).map((n) => n.midi)).toEqual([69]);
  });

  test('each note carries median clarity over its window (used for confidence)', () => {
    const frames = voiced(64, 0, 5, 0.8);
    const notes = segmentFrames(frames, CFG);
    expect(notes).toHaveLength(1);
    expect(notes[0].clarity).toBeCloseTo(0.8, 5);
  });

  test('a glitchy first frame (e.g. an octave misread on attack) does not corrupt the real note', () => {
    // One bad frame at a different pitch, then a sustained run of the correct one — the old
    // group[0]-anchored comparison would have locked the whole note to the glitch's pitch.
    const frames = [
      ...voiced(76, 0, 1), // E5 glitch, single frame
      ...voiced(64, 20, 5), // E4, the actual note
    ];
    const notes = segmentFrames(frames, CFG);
    expect(notes.map((n) => n.midi)).toEqual([64]);
  });

  test('a single-frame pitch blip mid-note is reabsorbed rather than splitting the note', () => {
    const frames = [
      ...voiced(64, 0, 3),
      ...voiced(67, 60, 1), // one stray frame, doesn't sustain
      ...voiced(64, 80, 3),
    ];
    const notes = segmentFrames(frames, CFG);
    expect(notes.map((n) => n.midi)).toEqual([64]);
  });
});
