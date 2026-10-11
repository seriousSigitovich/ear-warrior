// Practice-loop state machine (T028, US1). Orchestrates the core loop:
// idle → playingMelody → awaitingInput → capturing → grading → feedback, with replay/retry/next.
// Pure logic (generate, schedule, segment, grade, tuning) is composed with the injected audio services.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Attempt,
  AttemptGrade,
  CalibrationConfig,
  DetectedNote,
  DifficultyLevel,
  DifficultySettings,
  GradingConfig,
  InputMode,
  Melody,
  SegmentConfig,
} from '../../models';
import { DEFAULT_CALIBRATION_CONFIG, adaptiveClarityThreshold } from '../../lib/noiseFloor';
import { generateMelody } from '../../services/melody/generator';
import { getLevelByRank } from '../../services/melody/levels';
import {
  DEFAULT_DIFFICULTY_SETTINGS,
  applyAttempt,
  effectiveRank,
  toAttemptOutcome,
} from '../difficulty/adapt';
import { DifficultySettingsRepository } from '../../services/storage/repositories';
import { scheduleMelody } from '../../lib/schedule';
import { segmentFrames } from '../../lib/segment';
import { gradeAttempt } from '../../services/grading/grade';
import { AudioPlayback } from '../../services/audio/playback';
import { PitchDetectionConfig, PitchDetector } from '../../services/audio/pitch';
import { AudioSession } from '../../services/audio/session';
import { CaptureConfig, CaptureHandle, runCapture } from './capture';
import { TuningCheck, evaluateTuning } from './tuning';
import { midiFromHz } from '../../lib/pitchNote';
import {
  FretPosition,
  FretTap,
  addTap,
  makeTap,
  tapsToDetected,
  undoTap,
} from '../../lib/fretboard';

export type LoopPhase =
  'idle' | 'playingMelody' | 'awaitingInput' | 'capturing' | 'grading' | 'feedback';

export interface PracticeLoopDeps {
  /**
   * How the learner answers. `fretboard`: tap the notes on an on-screen neck — no microphone, no
   * capture window; the answer is submitted explicitly. `mic`: play a real instrument. Defaults to
   * `mic`, the behaviour before fretboard input existed.
   */
  inputMode?: InputMode;
  playback: AudioPlayback;
  detector: PitchDetector;
  session: AudioSession;
  pitchCfg: PitchDetectionConfig;
  segmentCfg: SegmentConfig;
  gradingCfg: GradingConfig;
  captureCfg: CaptureConfig;
  /** Adaptive-voicing calibration (Tier 1 noise robustness). Defaults when omitted. */
  calibrationCfg?: CalibrationConfig;
  seed: () => number;
  /** Persisted difficulty state (FR-011b). */
  difficulty: DifficultySettingsRepository;
  /**
   * Record a finished attempt (FR-012). Called for **every** attempt, including timed-out and
   * low-confidence ones — FR-011a excludes those from difficulty adaptation only, not from the
   * record. Supplied by the screen, which owns the session and the repositories.
   */
  onAttemptGraded?: (attempt: Attempt, melody: Melody, level: DifficultyLevel) => void;
  /** Id for the session these attempts belong to. */
  sessionId: string;
  /** Injected for testability; defaults to wall-clock time. */
  now?: () => Date;
}

/** A rank movement to surface in the feedback step, so difficulty never shifts silently. */
export interface RankChange {
  from: number;
  to: number;
  direction: 'up' | 'down';
}

/**
 * Live view of an in-flight attempt, for the "your turn" stage: how many note onsets have been
 * heard so far and what the most recent one sounded like. Authoritative note boundaries still come
 * from the segmenter at grading time — this is a provisional read for the UI only.
 */
export interface CaptureProgress {
  notesHeard: number;
  lastMidi: number | null;
}

const NO_PROGRESS: CaptureProgress = { notesHeard: 0, lastMidi: null };

export function usePracticeLoop(deps: PracticeLoopDeps) {
  const [phase, setPhase] = useState<LoopPhase>('idle');
  const [melody, setMelody] = useState<Melody | null>(null);
  const [grade, setGrade] = useState<AttemptGrade | null>(null);
  const [tuning, setTuning] = useState<TuningCheck | null>(null);
  const [progress, setProgress] = useState<CaptureProgress>(NO_PROGRESS);
  const [settings, setSettings] = useState<DifficultySettings>(DEFAULT_DIFFICULTY_SETTINGS);
  const [rankChange, setRankChange] = useState<RankChange | null>(null);
  // Fretboard input only: the notes tapped so far for the current melody, in order.
  const [answer, setAnswer] = useState<FretTap[]>([]);
  const inputMode: InputMode = deps.inputMode ?? 'mic';
  const handleRef = useRef<CaptureHandle | null>(null);
  const lastVoicedMsRef = useRef<number | null>(null);
  // Adaptation counts only the FIRST graded attempt per melody (FR-011a). A timed-out or
  // low-confidence attempt is not graded, so the following attempt is still the first graded one.
  const gradedThisMelodyRef = useRef(false);
  // Settings are read through a ref inside callbacks so adaptation always folds into the freshest
  // value, without every callback re-creating when the rank moves.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const answerRef = useRef(answer);
  answerRef.current = answer;

  const level = useMemo(() => getLevelByRank(effectiveRank(settings)), [settings]);
  // Same reason as settingsRef: callbacks read the level in effect at the moment they run.
  const levelRef = useRef(level);
  levelRef.current = level;

  useEffect(() => {
    let cancelled = false;
    deps.difficulty.load().then((loaded) => {
      if (!cancelled) setSettings(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [deps.difficulty]);

  // Monotonic within a session; combined with the unique session id this yields a unique attempt id.
  const attemptSeqRef = useRef(0);

  /** Record the attempt (FR-012) and fold it into difficulty state (FR-011/011a). */
  const completeAttempt = useCallback(
    (m: Melody, result: AttemptGrade, detected: DetectedNote[]) => {
      attemptSeqRef.current += 1;
      const attempt: Attempt = {
        id: `${deps.sessionId}-${attemptSeqRef.current}`,
        sessionId: deps.sessionId,
        melodyId: m.id,
        detectedNotes: detected,
        noteResults: result.noteResults,
        verdict: result.verdict,
        confidence: result.confidence,
        lowConfidence: result.lowConfidence,
        timedOut: result.timedOut,
        inputMode,
        createdAt: (deps.now?.() ?? new Date()).toISOString(),
      };
      deps.onAttemptGraded?.(attempt, m, levelRef.current);
    },
    [deps, inputMode],
  );

  /** Fold a finished attempt into difficulty state and persist the result (FR-011/011a). */
  const adapt = useCallback(
    async (result: AttemptGrade) => {
      const before = settingsRef.current;
      const outcome = toAttemptOutcome(result, gradedThisMelodyRef.current);
      const next = applyAttempt(before, outcome);
      if (outcome.graded) {
        gradedThisMelodyRef.current = true;
      }
      if (next === before) return;

      const from = effectiveRank(before);
      const to = effectiveRank(next);
      setSettings(next);
      setRankChange(to === from ? null : { from, to, direction: to > from ? 'up' : 'down' });
      await deps.difficulty.save(next);
    },
    [deps.difficulty],
  );

  const playMelody = useCallback(
    async (m: Melody) => {
      setPhase('playingMelody');
      await deps.session.enterPlayback();
      await deps.playback.playMelody(scheduleMelody(m, level.tempoBpm));
      setPhase('awaitingInput');
    },
    [deps, level.tempoBpm],
  );

  /**
   * Grade the notes an attempt produced and fold the result into feedback, the record and difficulty.
   * Shared by both input modes: the microphone path hands it segmented notes, the fretboard path
   * hands it notes built from taps — grading cannot tell them apart.
   */
  const finishAttempt = useCallback(
    async (m: Melody, detected: DetectedNote[], timedOut: boolean) => {
      setPhase('grading');
      const result = timedOut
        ? gradeAttempt(m, [], deps.gradingCfg) // empty → timedOut grade
        : gradeAttempt(m, detected, deps.gradingCfg);
      setGrade(result);
      setPhase('feedback');
      completeAttempt(m, result, detected);
      await adapt(result);
    },
    [deps.gradingCfg, adapt, completeAttempt],
  );

  const captureAndGrade = useCallback(
    async (m: Melody) => {
      setPhase('capturing');
      setProgress(NO_PROGRESS);
      setRankChange(null); // each attempt's feedback reflects only that attempt
      lastVoicedMsRef.current = null;
      // Microphone access is required to hear the attempt; requesting here triggers the OS prompt
      // on first use. Without it, capture silently records nothing. On denial, fall through to an
      // empty (timed-out) grade so the learner sees the retry state rather than a dead screen.
      const micGranted = await deps.session.ensureMicPermission();
      if (!micGranted) {
        setTuning(null);
        const denied = gradeAttempt(m, [], deps.gradingCfg);
        setGrade(denied);
        setPhase('feedback');
        completeAttempt(m, denied, []);
        await adapt(denied); // ungraded → no-op, but keeps one adaptation path
        return;
      }
      await deps.session.enterRecording();
      const { frames, timedOut } = await runCapture(deps.detector, deps.pitchCfg, deps.captureCfg, {
        onReady: (handle) => {
          handleRef.current = handle;
        },
        // Provisional onset rule for the live UI: a voiced frame that follows an inter-note gap
        // starts a new note. Same gap threshold the segmenter uses, so the count tracks it closely.
        onVoicedFrame: (frame) => {
          const prev = lastVoicedMsRef.current;
          lastVoicedMsRef.current = frame.timestampMs;
          const isOnset = prev === null || frame.timestampMs - prev >= deps.segmentCfg.gapMs;
          const midi = midiFromHz(frame.hz);
          setProgress((p) => ({
            notesHeard: isOnset ? p.notesHeard + 1 : p.notesHeard,
            lastMidi: midi,
          }));
        },
      });
      handleRef.current = null;
      await deps.session.release();

      // Tier 1 noise robustness: set the voicing gate relative to this capture's measured ambient
      // clarity (from its pre-onset lead-in + silent tail) instead of a fixed threshold, so a noisy
      // room raises the gate above the noise and a quiet room lowers it to catch a weak source.
      const clarityThreshold = adaptiveClarityThreshold(
        frames,
        deps.calibrationCfg ?? DEFAULT_CALIBRATION_CONFIG,
      );
      const detected = segmentFrames(frames, { ...deps.segmentCfg, clarityThreshold });
      setTuning(evaluateTuning(detected, deps.playback)); // advisory, non-blocking (FR-014)
      await finishAttempt(m, detected, timedOut);
    },
    [deps, adapt, completeAttempt, finishAttempt],
  );

  const next = useCallback(async () => {
    const m = generateMelody(level, deps.seed());
    setMelody(m);
    setGrade(null);
    setTuning(null);
    setProgress(NO_PROGRESS);
    setRankChange(null);
    setAnswer([]);
    gradedThisMelodyRef.current = false; // a new melody restarts first-attempt eligibility
    await playMelody(m);
  }, [deps, level, playMelody]);

  const replay = useCallback(async () => {
    if (melody) await playMelody(melody); // same melody, unchanged (FR-007)
  }, [melody, playMelody]);

  const retry = useCallback(async () => {
    if (!melody) return;
    if (inputMode === 'fretboard') {
      // No capture to rerun: clear the board and let the learner answer again, same melody (FR-008).
      setGrade(null);
      setTuning(null);
      setRankChange(null);
      setAnswer([]);
      setPhase('awaitingInput');
      return;
    }
    await captureAndGrade(melody); // same melody, fresh grading (FR-008)
  }, [melody, inputMode, captureAndGrade]);

  const beginAttempt = useCallback(async () => {
    if (melody) await captureAndGrade(melody);
  }, [melody, captureAndGrade]);

  /** Fretboard input: sound the tapped fret and add it to the answer (up to the melody's length). */
  const tapFret = useCallback(
    (position: FretPosition) => {
      if (inputMode !== 'fretboard' || phase !== 'awaitingInput' || !melody) return;
      const tap = makeTap(position, (deps.now?.() ?? new Date()).getTime());
      // Hearing the note is the point — it is how the learner compares it with the melody. It plays
      // even when the answer is already full, so a slot can be auditioned before undoing.
      deps.playback.playReferenceTone(tap.midi).catch(() => undefined);
      setAnswer((prev) => addTap(prev, tap, melody.notes.length));
    },
    [deps, inputMode, phase, melody],
  );

  const undoFret = useCallback(() => setAnswer((prev) => undoTap(prev)), []);
  const clearFrets = useCallback(() => setAnswer([]), []);

  /** Fretboard input: grade the answer as it stands ("Check"). Needs at least one note. */
  const submitAnswer = useCallback(async () => {
    const taps = answerRef.current;
    if (inputMode !== 'fretboard' || phase !== 'awaitingInput' || !melody || taps.length === 0) {
      return;
    }
    setTuning(null);
    await finishAttempt(melody, tapsToDetected(taps), false);
  }, [inputMode, phase, melody, finishAttempt]);

  /** End the capture window now and grade what was heard ("Stop & check"). */
  const stopAttempt = useCallback(() => {
    handleRef.current?.stop();
  }, []);

  return useMemo(
    () => ({
      phase,
      inputMode,
      answer,
      melody,
      grade,
      tuning,
      progress,
      level,
      settings,
      rankChange,
      next,
      replay,
      retry,
      beginAttempt,
      stopAttempt,
      tapFret,
      undoFret,
      clearFrets,
      submitAnswer,
    }),
    [
      phase,
      inputMode,
      answer,
      melody,
      grade,
      tuning,
      progress,
      level,
      settings,
      rankChange,
      next,
      replay,
      retry,
      beginAttempt,
      stopAttempt,
      tapFret,
      undoFret,
      clearFrets,
      submitAnswer,
    ],
  );
}
