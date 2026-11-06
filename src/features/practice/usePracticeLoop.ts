// Practice-loop state machine (T028, US1). Orchestrates the core loop:
// idle → playingMelody → awaitingInput → grading → feedback, with replay/retry/next.
// A replay is not a phase: it sounds the melody over whatever is on screen (the answer being placed,
// or the graded result), so the learner compares by ear without losing sight of their notes.
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
import { getLevelByRank } from '../../services/melody/levels';
import {
  DEFAULT_DIFFICULTY_SETTINGS,
  applyAttempt,
  effectiveRank,
  toAttemptOutcome,
} from '../difficulty/adapt';
import { TuneHistory, tuneIdOf } from '../../services/melody/curated';
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
   * Where the next melody comes from (FR-021): the library. `mastered` holds the ids of tunes already
   * played at 100%, which the library skips while the level has others.
   */
  nextMelody: (
    level: DifficultyLevel,
    seed: number,
    mastered: ReadonlySet<string>,
    recent: readonly string[],
  ) => Melody;
  /**
   * Which tunes were played and which at 100%: the backend's answer for a signed-in learner, else the
   * local record. The first melody waits for it. Must keep the same identity across renders.
   */
  loadHistory: () => Promise<TuneHistory>;
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
  /**
   * Playback speed in effect right now (1 = the tune's own tempo; see lib/speed). Read at each play, so
   * a change applies from the next play or replay. Defaults to full tempo.
   */
  speed?: () => number;
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

/** Sound `m` at `speed` × its own tempo: the schedule and the clip both slow down, the pitch stays. */
function playAt(playback: AudioPlayback, m: Melody, speed: number): Promise<void> {
  return playback.playMelody(scheduleMelody(m, m.tempoBpm * speed), tuneIdOf(m.id), speed);
}

export function usePracticeLoop(deps: PracticeLoopDeps) {
  const [phase, setPhase] = useState<LoopPhase>('idle');
  const [melody, setMelody] = useState<Melody | null>(null);
  const [grade, setGrade] = useState<AttemptGrade | null>(null);
  const [settings, setSettings] = useState<DifficultySettings>(DEFAULT_DIFFICULTY_SETTINGS);
  const [rankChange, setRankChange] = useState<RankChange | null>(null);
  // The notes tapped so far for the current melody, in order.
  const [answer, setAnswer] = useState<FretTap[]>([]);
  // A replay is sounding. Kept apart from `phase` so replaying never swaps the screen.
  const [replaying, setReplaying] = useState(false);
  // Bumped whenever a replay ends early (stop, a tap, check, next): a clip's promise resolves on its
  // own clock, so a replay only clears the flag if nothing has superseded it meanwhile.
  const replayTokenRef = useRef(0);
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

  // Tunes played at 100% so far, and every tune in play order: loaded from the recorded attempts
  // (once they are hydrated from the backend), then grown as attempts finish and tunes are served.
  const masteredRef = useRef<Set<string>>(new Set());
  const recentRef = useRef<string[]>([]);
  const historyRef = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    let cancelled = false;
    historyRef.current = deps
      .loadHistory()
      .then((history) => {
        if (cancelled) return;
        for (const id of history.mastered) masteredRef.current.add(id);
        recentRef.current = [...history.recent, ...recentRef.current];
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [deps.loadHistory]);

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
      if (result.verdict === 'correct') masteredRef.current.add(tuneIdOf(m.id));
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
      await playAt(deps.playback, m, deps.speed?.() ?? 1);
      setPhase('awaitingInput');
    },
    [deps],
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

  /** End a sounding replay at once. With `silence`, also cut the audio (a tap cuts it by itself). */
  const endReplay = useCallback(
    (silence: boolean) => {
      replayTokenRef.current += 1;
      setReplaying(false);
      if (silence) deps.playback.stop().catch(() => undefined);
    },
    [deps.playback],
  );

  const next = useCallback(async () => {
    endReplay(false); // the new melody's playback cuts the old audio itself
    await historyRef.current; // pick against the full history, not a half-loaded one
    const m = deps.nextMelody(level, deps.seed(), masteredRef.current, recentRef.current);
    recentRef.current.push(tuneIdOf(m.id));
    setMelody(m);
    setGrade(null);
    setRankChange(null);
    setAnswer([]);
    gradedThisMelodyRef.current = false; // a new melody restarts first-attempt eligibility
    await playMelody(m);
  }, [deps, level, playMelody, endReplay]);

  /** Sound the same melody again (FR-007) over the current screen; the phase does not change. */
  const replay = useCallback(async () => {
    if (!melody || (phase !== 'awaitingInput' && phase !== 'feedback')) return;
    const token = ++replayTokenRef.current;
    setReplaying(true);
    try {
      await deps.session.enterPlayback();
      await playAt(deps.playback, melody, deps.speed?.() ?? 1);
    } finally {
      if (replayTokenRef.current === token) setReplaying(false);
    }
  }, [deps, melody, phase]);

  const stopReplay = useCallback(() => endReplay(true), [endReplay]);

  const retry = useCallback(() => {
    if (!melody) return;
    if (replaying) endReplay(true);
    // Clear the board and let the learner answer again, same melody (FR-008).
    setGrade(null);
    setRankChange(null);
    setAnswer([]);
    setPhase('awaitingInput');
  }, [melody, replaying, endReplay]);

  /** Sound the tapped fret and add it to the answer (up to the melody's length). */
  const tapFret = useCallback(
    (position: FretPosition) => {
      if (phase !== 'awaitingInput' || !melody) return;
      // Tapping means the learner has heard enough: the tone below cuts the replay's audio.
      if (replaying) endReplay(false);
      const tap = makeTap(position, (deps.now?.() ?? new Date()).getTime());
      // Hearing the note is the point — it is how the learner compares it with the melody. It plays
      // even when the answer is already full, so a slot can be auditioned before undoing.
      deps.playback.playReferenceTone(tap.midi).catch(() => undefined);
      setAnswer((prev) => addTap(prev, tap, melody.notes.length));
    },
    [deps, phase, melody, replaying, endReplay],
  );

  const undoFret = useCallback(() => setAnswer((prev) => undoTap(prev)), []);
  const clearFrets = useCallback(() => setAnswer([]), []);

  /** Grade the answer as it stands ("Check"). Needs at least one note. */
  const submitAnswer = useCallback(async () => {
    const taps = answerRef.current;
    if (phase !== 'awaitingInput' || !melody || taps.length === 0) return;
    if (replaying) endReplay(true);
    await finishAttempt(melody, tapsToDetected(taps));
  }, [phase, melody, finishAttempt, replaying, endReplay]);

  return useMemo(
    () => ({
      phase,
      replaying,
      answer,
      melody,
      grade,
      level,
      settings,
      rankChange,
      next,
      replay,
      stopReplay,
      retry,
      tapFret,
      undoFret,
      clearFrets,
      submitAnswer,
    }),
    [
      phase,
      replaying,
      answer,
      melody,
      grade,
      level,
      settings,
      rankChange,
      next,
      replay,
      stopReplay,
      retry,
      tapFret,
      undoFret,
      clearFrets,
      submitAnswer,
    ],
  );
}
