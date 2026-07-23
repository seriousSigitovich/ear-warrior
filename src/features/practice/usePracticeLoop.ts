// Practice-loop state machine (T028, US1). Orchestrates the core loop:
// idle → playingMelody → awaitingInput → capturing → grading → feedback, with replay/retry/next.
// Pure logic (generate, schedule, segment, grade, tuning) is composed with the injected audio services.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AttemptGrade,
  DifficultySettings,
  GradingConfig,
  Melody,
  SegmentConfig,
} from '../../models';
import { generateMelody } from '../../services/melody/generator';
import { getLevelByRank } from '../../services/melody/levels';
import { DEFAULT_DIFFICULTY_SETTINGS, applyAttempt, effectiveRank } from '../difficulty/adapt';
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

export type LoopPhase =
  | 'idle'
  | 'playingMelody'
  | 'awaitingInput'
  | 'capturing'
  | 'grading'
  | 'feedback';

export interface PracticeLoopDeps {
  playback: AudioPlayback;
  detector: PitchDetector;
  session: AudioSession;
  pitchCfg: PitchDetectionConfig;
  segmentCfg: SegmentConfig;
  gradingCfg: GradingConfig;
  captureCfg: CaptureConfig;
  seed: () => number;
  /** Persisted difficulty state (FR-011b). */
  difficulty: DifficultySettingsRepository;
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
  const handleRef = useRef<CaptureHandle | null>(null);
  const lastVoicedMsRef = useRef<number | null>(null);
  // Adaptation counts only the FIRST graded attempt per melody (FR-011a). A timed-out or
  // low-confidence attempt is not graded, so the following attempt is still the first graded one.
  const gradedThisMelodyRef = useRef(false);
  // Settings are read through a ref inside callbacks so adaptation always folds into the freshest
  // value, without every callback re-creating when the rank moves.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const level = useMemo(() => getLevelByRank(effectiveRank(settings)), [settings]);

  useEffect(() => {
    let cancelled = false;
    deps.difficulty.load().then((loaded) => {
      if (!cancelled) setSettings(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [deps.difficulty]);

  /** Fold a finished attempt into difficulty state and persist the result (FR-011/011a). */
  const adapt = useCallback(
    async (result: AttemptGrade) => {
      const before = settingsRef.current;
      const next = applyAttempt(before, {
        verdict: result.verdict,
        graded: !result.timedOut && !result.lowConfidence,
        isFirstAttemptOnMelody: !gradedThisMelodyRef.current,
      });
      if (!result.timedOut && !result.lowConfidence) {
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

      const detected = segmentFrames(frames, deps.segmentCfg);
      setTuning(evaluateTuning(detected, deps.playback)); // advisory, non-blocking (FR-014)

      setPhase('grading');
      const result = timedOut
        ? gradeAttempt(m, [], deps.gradingCfg) // empty → timedOut grade
        : gradeAttempt(m, detected, deps.gradingCfg);
      setGrade(result);
      setPhase('feedback');
      await adapt(result);
    },
    [deps, adapt],
  );

  const next = useCallback(async () => {
    const m = generateMelody(level, deps.seed());
    setMelody(m);
    setGrade(null);
    setTuning(null);
    setProgress(NO_PROGRESS);
    setRankChange(null);
    gradedThisMelodyRef.current = false; // a new melody restarts first-attempt eligibility
    await playMelody(m);
  }, [deps, level, playMelody]);

  const replay = useCallback(async () => {
    if (melody) await playMelody(melody); // same melody, unchanged (FR-007)
  }, [melody, playMelody]);

  const retry = useCallback(async () => {
    if (melody) await captureAndGrade(melody); // same melody, fresh grading (FR-008)
  }, [melody, captureAndGrade]);

  const beginAttempt = useCallback(async () => {
    if (melody) await captureAndGrade(melody);
  }, [melody, captureAndGrade]);

  /** End the capture window now and grade what was heard ("Stop & check"). */
  const stopAttempt = useCallback(() => {
    handleRef.current?.stop();
  }, []);

  return useMemo(
    () => ({
      phase,
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
    }),
    [
      phase,
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
    ],
  );
}
