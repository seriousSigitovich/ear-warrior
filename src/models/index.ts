// Domain types for Guitar Ear Training (data-model.md).
// Pure, serializable value types shared across the pure-logic core and the (deferred) native/UI layers.

/** A single target pitch inside a generated Melody. */
export interface Note {
  /** Position in the sequence (0-based). */
  index: number;
  /** MIDI note number; guitar range 40 (E2) – 88 (E6). */
  midi: number;
  /** Human-readable name derived from `midi`, e.g. "E4". */
  noteName: string;
  /** Ideal equal-temperament frequency (A4 = 440 Hz). */
  frequencyHz: number;
  /** Deviation from the nearest note in cents; 0 for generated targets. */
  centsOffset: number;
  /** Relative duration in beats (target only). */
  durationBeats: number;
}

/** A discrete note recovered from the microphone pitch stream by the segmenter. */
export interface DetectedNote {
  index: number;
  /** Nearest MIDI note number for the note's median frequency. */
  midi: number;
  /** Median detected frequency over the note's stable window. */
  frequencyHz: number;
  /** Signed deviation from the nearest note in cents. */
  centsOffset: number;
  /** Median YIN clarity (0–1) over the note's stable window; used for confidence (FR-017). */
  clarity: number;
  startMs: number;
  endMs: number;
}

/** One monophonic pitch frame from the native detector (contracts/pitch-detection.md). */
export interface PitchFrame {
  /** Detected fundamental in Hz; 0 when unvoiced. */
  hz: number;
  /** YIN confidence 0–1. */
  clarity: number;
  /** Monotonic capture time in ms. */
  timestampMs: number;
}

export type NoteStatus = 'matched' | 'wrong' | 'missed' | 'extra';

/** Per-position grading outcome, aligned to the target sequence. */
export interface NoteResult {
  /** Target index, or null for an `extra` played note. */
  targetIndex: number | null;
  status: NoteStatus;
  expectedMidi: number | null;
  detectedMidi: number | null;
  /** Correct pitch class in the wrong octave. */
  octaveMismatch: boolean;
}

export type Verdict = 'correct' | 'incorrect';

/** Full grading of one attempt (contracts/grading-engine.md). */
export interface AttemptGrade {
  noteResults: NoteResult[];
  verdict: Verdict;
  /** Minimum per-note clarity across the attempt (FR-017). */
  confidence: number;
  /** True when confidence < the calibratable threshold. */
  lowConfidence: boolean;
  /** True when there was no/insufficient input to grade (FR-015). */
  timedOut: boolean;
}

/** Named generation configuration (FR-010). */
export interface DifficultyLevel {
  id: string;
  rank: number;
  /** 2 at easiest … up to 8 (SC-005). */
  noteCount: number;
  /** Scale name, e.g. "C_major_pentatonic". */
  scale: string;
  rangeLowMidi: number;
  rangeHighMidi: number;
  tempoBpm: number;
}

/** An ordered target sequence the learner must reproduce (FR-001). */
export interface Melody {
  id: string;
  notes: Note[];
  difficultyId: string;
  scale: string;
  createdAt: string;
}

export type TuningDirection = 'sharp' | 'flat' | 'none';

/** Result of the systematic-detune check (contracts/tuning-check.md, FR-014). */
export interface TuningWarning {
  outOfTune: boolean;
  medianCents: number;
  direction: TuningDirection;
}

// ---- Calibratable configuration (empirical constants tuned on-device per research.md) ----

export interface SegmentConfig {
  /** Frames below this clarity are treated as silence. */
  clarityThreshold: number;
  /** Minimum stable duration (ms) for a sound to count as a played note. */
  minNoteMs: number;
  /** Silence gap (ms) that separates two consecutive notes — the short segmentation gap (FR-004). */
  gapMs: number;
  /** Lowest accepted frequency (Hz); below → out of guitar band. */
  minHz: number;
  /** Highest accepted frequency (Hz); above → out of guitar band. */
  maxHz: number;
}

export interface GradingConfig {
  /** Fixed ±50 (FR-016); a pitch closer to an adjacent semitone never matches. */
  centsTolerance: number;
  /** Default true (spec assumption): wrong octave is not a match. */
  octaveSensitive: boolean;
  /** Confidence below this flags the attempt low-confidence (FR-017). */
  lowConfidenceThreshold: number;
}

export interface TuningConfig {
  /** Magnitude of a systematic offset that triggers the warning (default ~35). */
  centsThreshold: number;
  /** Minimum notes required before judging tune (default 3). */
  minNotes: number;
}
