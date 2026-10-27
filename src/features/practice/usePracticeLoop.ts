// Practice-loop state machine (T028, US1). Orchestrates the core loop:
// idle → playingMelody → awaitingInput → grading → feedback, with replay/retry/next.
// The learner answers by tapping notes on an on-screen fretboard; pure logic (melody, schedule,
// grade) is composed with the injected playback service.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Attempt,
  AttemptGrade,
  DetectedNote,
  DifficultyLevel,
  DifficultySettings,
  GradingConfig,
  Melody,
} from '../../models';
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
import { gradeAttempt } from '../../services/grading/grade';
import { AudioPlayback } from '../../services/audio/playback';
import { AudioSession } from '../../services/audio/session';
import {
  FretPosition,
  FretTap,
  addTap,
  makeTap,
  tapsToDetected,
  undoTap,
} from '../../lib/fretboard';

export type LoopPhase = 'idle' | 'playingMelody' | 'awaitingInput' | 'grading' | 'feedback';

export interface PracticeLoopDeps {
  /**
   * Where the next melody comes from (FR-021): the curated set in the MVP build. Defaults to the
   * generator, the behaviour before the curated set existed.
   */
  nextMelody?: (level: DifficultyLevel, seed: number) => Melody;
  playback: AudioPlayback;
  session: AudioSession;
  gradingCfg: GradingConfig;
  seed: () => number;
  /** Persisted difficulty state (FR-011b). */
  difficulty: DifficultySettingsRepository;
  /**
   * Record a finished attempt (FR-012). Supplied by the screen, which owns the session and the
   * repositories.
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

export function usePracticeLoop(deps: PracticeLoopDeps) {
  const [phase, setPhase] = useState<LoopPhase>('idle');
  const [melody, setMelody] = useState<Melody | null>(null);
  const [grade, setGrade] = useState<AttemptGrade | null>(null);
  const [settings, setSettings] = useState<DifficultySettings>(DEFAULT_DIFFICULTY_SETTINGS);
  const [rankChange, setRankChange] = useState<RankChange | null>(null);
  // The notes tapped so far for the current melody, in order.
  const [answer, setAnswer] = useState<FretTap[]>([]);
  // Adaptation counts only the FIRST graded attempt per melody (FR-011a): a retry does not move it.
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
        inputMode: 'fretboard',
        createdAt: (deps.now?.() ?? new Date()).toISOString(),
      };
      deps.onAttemptGraded?.(attempt, m, levelRef.current);
    },
    [deps],
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

  /** Grade the notes the learner tapped and fold the result into feedback, the record and difficulty. */
  const finishAttempt = useCallback(
    async (m: Melody, detected: DetectedNote[]) => {
      setPhase('grading');
      const result = gradeAttempt(m, detected, deps.gradingCfg);
      setGrade(result);
      setPhase('feedback');
      completeAttempt(m, result, detected);
      await adapt(result);
    },
    [deps.gradingCfg, adapt, completeAttempt],
  );

  const next = useCallback(async () => {
    const m = (deps.nextMelody ?? generateMelody)(level, deps.seed());
    setMelody(m);
    setGrade(null);
    setRankChange(null);
    setAnswer([]);
    gradedThisMelodyRef.current = false; // a new melody restarts first-attempt eligibility
    await playMelody(m);
  }, [deps, level, playMelody]);

  const replay = useCallback(async () => {
    if (melody) await playMelody(melody); // same melody, unchanged (FR-007)
  }, [melody, playMelody]);

  const retry = useCallback(() => {
    if (!melody) return;
    // Clear the board and let the learner answer again, same melody (FR-008).
    setGrade(null);
    setRankChange(null);
    setAnswer([]);
    setPhase('awaitingInput');
  }, [melody]);

  /** Sound the tapped fret and add it to the answer (up to the melody's length). */
  const tapFret = useCallback(
    (position: FretPosition) => {
      if (phase !== 'awaitingInput' || !melody) return;
      const tap = makeTap(position, (deps.now?.() ?? new Date()).getTime());
      // Hearing the note is the point — it is how the learner compares it with the melody. It plays
      // even when the answer is already full, so a slot can be auditioned before undoing.
      deps.playback.playReferenceTone(tap.midi).catch(() => undefined);
      setAnswer((prev) => addTap(prev, tap, melody.notes.length));
    },
    [deps, phase, melody],
  );

  const undoFret = useCallback(() => setAnswer((prev) => undoTap(prev)), []);
  const clearFrets = useCallback(() => setAnswer([]), []);

  /** Grade the answer as it stands ("Check"). Needs at least one note. */
  const submitAnswer = useCallback(async () => {
    const taps = answerRef.current;
    if (phase !== 'awaitingInput' || !melody || taps.length === 0) return;
    await finishAttempt(melody, tapsToDetected(taps));
  }, [phase, melody, finishAttempt]);

  return useMemo(
    () => ({
      phase,
      answer,
      melody,
      grade,
      level,
      settings,
      rankChange,
      next,
      replay,
      retry,
      tapFret,
      undoFret,
      clearFrets,
      submitAnswer,
    }),
    [
      phase,
      answer,
      melody,
      grade,
      level,
      settings,
      rankChange,
      next,
      replay,
      retry,
      tapFret,
      undoFret,
      clearFrets,
      submitAnswer,
    ],
  );
}
