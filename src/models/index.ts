// Domain types for Guitar Ear Training (data-model.md).
// Pure, serializable value types shared across the pure-logic core and the (deferred) native/UI layers.

/** A single target pitch inside a Melody. */
export interface Note {
  /** Position in the sequence (0-based). */
  index: number;
  /** MIDI note number; guitar range 40 (E2) – 88 (E6). */
  midi: number;
  /** Human-readable name derived from `midi`, e.g. "E4". */
  noteName: string;
  /** Ideal equal-temperament frequency (A4 = 440 Hz). */
  frequencyHz: number;
  /** Deviation from the nearest note in cents; 0 for target notes. */
  centsOffset: number;
  /** Relative duration in beats (target only). */
  durationBeats: number;
}

/** A note the learner answered with, built from a fretboard tap (see `tapsToDetected`). */
export interface DetectedNote {
  index: number;
  /** MIDI note number of the answered note. */
  midi: number;
  /** Frequency of the answered note. */
  frequencyHz: number;
  /** Signed deviation from the nearest note in cents. */
  centsOffset: number;
  /** Always 1 for a fretboard tap; kept because attempts persist it (FR-017). */
  clarity: number;
  startMs: number;
  endMs: number;
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

/** One rung of the difficulty ladder (FR-010): what a melody at this rank looks like. */
export interface DifficultyLevel {
  id: string;
  /** 1–9, ordering for adaptation. */
  rank: number;
  noteCount: number;
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

/**
 * How an attempt was answered. The app only answers on the on-screen fretboard; `mic` survives so
 * attempts recorded before the microphone input was removed keep their meaning when read back.
 */
export type InputMode = 'mic' | 'fretboard';

/** One captured reproduction of a melody and its grading (FR-005, FR-006, FR-012). */
export interface Attempt {
  id: string;
  sessionId: string;
  melodyId: string;
  detectedNotes: DetectedNote[];
  noteResults: NoteResult[];
  verdict: Verdict;
  /** Minimum per-note clarity across the attempt (FR-017). */
  confidence: number;
  lowConfidence: boolean;
  timedOut: boolean;
  /** Absent on attempts recorded before fretboard input existed — those were all `mic`. */
  inputMode?: InputMode;
  createdAt: string;
}

export type DifficultyMode = 'adaptive' | 'fixed';

/** Which run of consecutive qualifying attempts is currently accumulating. */
export type StreakKind = 'correct' | 'incorrect' | 'none';

/**
 * The learner's persisted difficulty state (FR-011, FR-011a, FR-011b). Singleton per install.
 * `adaptiveRank` and `fixedRank` are deliberately independent: selecting a fixed level for a warm-up
 * must not erase adaptive progress.
 */
export interface DifficultySettings {
  mode: DifficultyMode;
  /** Rank adaptive mode last held (1–7). */
  adaptiveRank: number;
  /** Manually selected rank (1–7); no unlock gating. */
  fixedRank: number;
  streakKind: StreakKind;
  /** Consecutive qualifying attempts of `streakKind`. */
  streakCount: number;
}

/**
 * One finished attempt as the practice loop observes it, for difficulty adaptation only.
 * `graded` is false for a timed-out or low-confidence capture; `isFirstAttemptOnMelody` is false
 * once the learner has retried. Both false cases are excluded from the streak (FR-011a).
 */
export interface AttemptOutcome {
  verdict: Verdict;
  graded: boolean;
  isFirstAttemptOnMelody: boolean;
}

/** A continuous practice run containing multiple attempts (FR-018). */
export interface Session {
  id: string;
  startedAt: string;
  /** null while active. */
  endedAt: string | null;
  difficultyMode: DifficultyMode;
  currentDifficultyId: string;
  attemptCount: number;
  accuracyPct: number;
}

/** Aggregated cross-session view for the single local learner (FR-013, US3). Derived, not stored. */
export interface ProgressProfile {
  accuracyTrend: { date: string; accuracyPct: number }[];
  practiceVolume: { totalAttempts: number; totalSessions: number; totalMinutes: number };
  difficultyReached: number;
  weakAreas: { descriptor: string; missRate: number }[];
}

// ---- Calibratable configuration ----

export interface GradingConfig {
  /** Fixed ±50 (FR-016); a pitch closer to an adjacent semitone never matches. */
  centsTolerance: number;
  /** Default true (spec assumption): wrong octave is not a match. */
  octaveSensitive: boolean;
  /** Confidence below this flags the attempt low-confidence (FR-017). */
  lowConfidenceThreshold: number;
}
