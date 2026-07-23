// Practice-loop state machine (T028, US1). Orchestrates the core loop:
// idle → playingMelody → awaitingInput → capturing → grading → feedback, with replay/retry/next.
// Pure logic (generate, schedule, segment, grade, tuning) is composed with the injected audio services.
import { useCallback, useMemo, useState } from 'react';
import { AttemptGrade, DifficultyLevel, GradingConfig, Melody, SegmentConfig } from '../../models';
import { generateMelody } from '../../services/melody/generator';
import { scheduleMelody } from '../../lib/schedule';
import { segmentFrames } from '../../lib/segment';
import { gradeAttempt } from '../../services/grading/grade';
import { AudioPlayback } from '../../services/audio/playback';
import { PitchDetectionConfig, PitchDetector } from '../../services/audio/pitch';
import { AudioSession } from '../../services/audio/session';
import { CaptureConfig, runCapture } from './capture';
import { TuningCheck, evaluateTuning } from './tuning';

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
}

export function usePracticeLoop(level: DifficultyLevel, deps: PracticeLoopDeps) {
  const [phase, setPhase] = useState<LoopPhase>('idle');
  const [melody, setMelody] = useState<Melody | null>(null);
  const [grade, setGrade] = useState<AttemptGrade | null>(null);
  const [tuning, setTuning] = useState<TuningCheck | null>(null);

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
      // Microphone access is required to hear the attempt; requesting here triggers the OS prompt
      // on first use. Without it, capture silently records nothing. On denial, fall through to an
      // empty (timed-out) grade so the learner sees the retry state rather than a dead screen.
      const micGranted = await deps.session.ensureMicPermission();
      if (!micGranted) {
        setTuning(null);
        setGrade(gradeAttempt(m, [], deps.gradingCfg));
        setPhase('feedback');
        return;
      }
      await deps.session.enterRecording();
      const { frames, timedOut } = await runCapture(deps.detector, deps.pitchCfg, deps.captureCfg);
      await deps.session.release();

      const detected = segmentFrames(frames, deps.segmentCfg);
      setTuning(evaluateTuning(detected, deps.playback)); // advisory, non-blocking (FR-014)

      setPhase('grading');
      const result = timedOut
        ? gradeAttempt(m, [], deps.gradingCfg) // empty → timedOut grade
        : gradeAttempt(m, detected, deps.gradingCfg);
      setGrade(result);
      setPhase('feedback');
    },
    [deps],
  );

  const next = useCallback(async () => {
    const m = generateMelody(level, deps.seed());
    setMelody(m);
    setGrade(null);
    setTuning(null);
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

  return useMemo(
    () => ({ phase, melody, grade, tuning, next, replay, retry, beginAttempt }),
    [phase, melody, grade, tuning, next, replay, retry, beginAttempt],
  );
}
