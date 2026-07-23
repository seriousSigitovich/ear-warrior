// Practice-loop state machine (T028, US1). Orchestrates the core loop:
// idle → playingMelody → awaitingInput → capturing → grading → feedback, with replay/retry/next.
// Pure logic (generate, schedule, segment, grade, tuning) is composed with the injected audio services.
import { useCallback, useMemo, useRef, useState } from 'react';
import { AttemptGrade, DifficultyLevel, GradingConfig, Melody, SegmentConfig } from '../../models';
import { generateMelody } from '../../services/melody/generator';
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

export function usePracticeLoop(level: DifficultyLevel, deps: PracticeLoopDeps) {
  const [phase, setPhase] = useState<LoopPhase>('idle');
  const [melody, setMelody] = useState<Melody | null>(null);
  const [grade, setGrade] = useState<AttemptGrade | null>(null);
  const [tuning, setTuning] = useState<TuningCheck | null>(null);
  const [progress, setProgress] = useState<CaptureProgress>(NO_PROGRESS);
  const handleRef = useRef<CaptureHandle | null>(null);
  const lastVoicedMsRef = useRef<number | null>(null);

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
      lastVoicedMsRef.current = null;
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
    },
    [deps],
  );

  const next = useCallback(async () => {
    const m = generateMelody(level, deps.seed());
    setMelody(m);
    setGrade(null);
    setTuning(null);
    setProgress(NO_PROGRESS);
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
    () => ({ phase, melody, grade, tuning, progress, next, replay, retry, beginAttempt, stopAttempt }),
    [phase, melody, grade, tuning, progress, next, replay, retry, beginAttempt, stopAttempt],
  );
}
