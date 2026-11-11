// Practice-loop state machine (T028, US1). A tune is learnt phrase by phrase:
//   idle → playingMelody (the whole tune) → for each phrase:
//     playingMelody (the phrase) → awaitingInput → grading → feedback → (retry | next phrase)
//   → complete (the tune is named, summed up and played whole once more) → next tune.
// A phrase fits in the ear's working memory where a 60-note tune does not, and the tune stays whole:
// each phrase is heard in place, and the tune is played in full at both ends.
// While listening (`playingMelody`, tune or phrase) the learner can pause, start over or skip ahead.
// A replay is not a phase: it sounds the phrase (or, once complete, the tune) over whatever is on
// screen, so the learner compares by ear without losing sight of their notes.
// The learner answers by tapping notes on an on-screen fretboard; pure logic (melody, phrases,
// schedule, grade) is composed with the injected playback service.
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
import { MIN_RANK, getLevel, getLevelByRank } from '../../services/melody/levels';
import {
  DEFAULT_DIFFICULTY_SETTINGS,
  applyAttempt,
  effectiveRank,
  toAttemptOutcome,
} from '../difficulty/adapt';
import { TuneHistory, tuneIdOf } from '../../services/melody/curated';
import { DifficultySettingsRepository } from '../../services/storage/repositories';
import { beatMs, scheduleMelody } from '../../lib/schedule';
import {
  combinePhraseAnswers,
  combinePhraseGrades,
  phraseCount,
  phraseMelody,
  phraseStartBeats,
} from '../../lib/phrases';
import { gradeAttempt } from '../../services/grading/grade';
import { AudioPlayback } from '../../services/audio/playback';
import { AudioSession } from '../../services/audio/session';
import {
  FretPosition,
  FretTap,
  addTap,
  fretMidi,
  makeTap,
  tapsToDetected,
  undoTap,
} from '../../lib/fretboard';
import { fingering } from '../../lib/hints';

export type LoopPhase =
  'idle' | 'playingMelody' | 'awaitingInput' | 'grading' | 'feedback' | 'complete';

/** What `playingMelody` is sounding: the whole tune up front, or the phrase to answer. */
export type Listening = 'tune' | 'phrase';

/** A phrase was checked. `first` is the learner's first try at it — the one the tune is scored on. */
export interface PhraseCheck {
  phrase: number;
  phrases: number;
  grade: AttemptGrade;
  first: boolean;
  /** The play of the melody this phrase belongs to (its served id), and the melody's level id. */
  melodyId: string;
  level: string;
}

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
   * Record a finished tune (FR-012): one attempt for the whole tune, made of the first try at each of
   * its phrases. Supplied by the screen, which owns the session and the repositories.
   */
  onAttemptGraded?: (attempt: Attempt, melody: Melody, level: DifficultyLevel) => void;
  /** A phrase was checked (for analytics). */
  onPhraseChecked?: (check: PhraseCheck) => void;
  /**
   * Playback speed in effect right now (1 = the tune's own tempo; see lib/speed), read as each play
   * starts. A change while a melody sounds goes straight to the playback service. Defaults to full tempo.
   */
  speed?: () => number;
  /** Id for the session these attempts belong to. */
  sessionId: string;
  /**
   * Whether a finished tune counts: recorded, folded into difficulty and remembered as played. False
   * for a warm-up such as the first melody a new learner plays. Defaults to every tune counting.
   */
  scored?: (m: Melody) => boolean;
  /**
   * Once the answer is full, a tap replaces its last note instead of only sounding: the learner
   * searches for the last note by ear without undoing first (the first melody). Default off.
   */
  tapReplacesLast?: boolean;
  /**
   * Whether a finished tune moves the difficulty rank. False for a tune the learner picked from the
   * library: it is recorded, but an old favourite replayed (or a hard one tried early) is not evidence
   * of the level they should be served at. Defaults to every scored tune adapting.
   */
  adapts?: (m: Melody) => boolean;
  /** Injected for testability; defaults to wall-clock time. */
  now?: () => Date;
}

/** A rank movement to surface when a tune is done, so difficulty never shifts silently. */
export interface RankChange {
  from: number;
  to: number;
  direction: 'up' | 'down';
}

/** Breath between the whole tune and its first phrase. */
const INTRO_GAP_MS = 600;

const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Sound the whole tune at `speed` × its own tempo: schedule and clip both slow down, pitch stays. */
function playTuneAt(playback: AudioPlayback, m: Melody, speed: number): Promise<void> {
  return playback.playMelody(scheduleMelody(m, m.tempoBpm * speed), tuneIdOf(m.id), speed);
}

/** Sound phrase `i` of the tune, out of the tune's own clip. */
function playPhraseAt(playback: AudioPlayback, m: Melody, i: number, speed: number): Promise<void> {
  const fromMs = phraseStartBeats(m, i) * beatMs(m.tempoBpm);
  return playback.playMelody(
    scheduleMelody(phraseMelody(m, i), m.tempoBpm * speed),
    tuneIdOf(m.id),
    speed,
    fromMs,
  );
}

export function usePracticeLoop(deps: PracticeLoopDeps) {
  const [phase, setPhase] = useState<LoopPhase>('idle');
  const [listening, setListening] = useState<Listening>('tune');
  const [melody, setMelody] = useState<Melody | null>(null);
  const [phraseIndex, setPhraseIndex] = useState(0);
  // The grade of the phrase on screen (feedback), and of the whole tune (complete).
  const [grade, setGrade] = useState<AttemptGrade | null>(null);
  const [tuneGrade, setTuneGrade] = useState<AttemptGrade | null>(null);
  // First-try grade of each phrase so far, for the progress bar.
  const [phraseGrades, setPhraseGrades] = useState<AttemptGrade[]>([]);
  const [settings, setSettings] = useState<DifficultySettings>(DEFAULT_DIFFICULTY_SETTINGS);
  const [rankChange, setRankChange] = useState<RankChange | null>(null);
  // The notes tapped so far for the current phrase, in order.
  const [answer, setAnswer] = useState<FretTap[]>([]);
  // A replay is sounding. Kept apart from `phase` so replaying never swaps the screen.
  const [replaying, setReplaying] = useState(false);
  // Failed checks on the phrase on screen: enough of them and help is offered (lib/hints).
  const [fails, setFails] = useState(0);
  // Where the phrase's first note lives, once the learner asked for it.
  const [hint, setHint] = useState<FretPosition | null>(null);
  // Bumped whenever a replay ends early (stop, a tap, check, next): a clip's promise resolves on its
  // own clock, so a replay only clears the flag if nothing has superseded it meanwhile.
  const replayTokenRef = useRef(0);
  // Bumped by each new tune: a tune's intro → first phrase hand-over only runs if it is still current.
  const tuneTokenRef = useRef(0);
  // What the learner asked of the melody being listened to (`playingMelody`): its play-through reads
  // this when the audio ends, to tell "heard out" from "start over" and "enough, move on".
  const listenAskRef = useRef<'none' | 'restart' | 'skip'>('none');
  // The melody being listened to is held (pause).
  const [paused, setPaused] = useState(false);
  // First try at each phrase: what the tune is scored on (a retry is practice, FR-011a).
  const firstGradesRef = useRef<AttemptGrade[]>([]);
  const firstAnswersRef = useRef<DetectedNote[][]>([]);
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

  const phrase = useMemo(
    () => (melody ? phraseMelody(melody, phraseIndex) : null),
    [melody, phraseIndex],
  );
  const phrases = melody ? phraseCount(melody) : 0;
  const scored = useCallback((m: Melody) => deps.scored?.(m) ?? true, [deps]);

  // Leaving the screen ends the tune: nothing queued (the first phrase after the intro) may start
  // playing behind another screen.
  useEffect(
    () => () => {
      tuneTokenRef.current += 1;
      deps.playback.stop().catch(() => undefined);
    },
    [deps.playback],
  );

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

  /** Record the finished tune (FR-012). */
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
      // The tune's own level: a tune picked from the library need not be on the rank in effect.
      deps.onAttemptGraded?.(attempt, m, getLevel(m.difficultyId));
    },
    [deps],
  );

  /** Fold a finished tune into difficulty state (FR-011): once per tune, on its first tries. */
  const adapt = useCallback(
    async (result: AttemptGrade) => {
      const before = settingsRef.current;
      const next = applyAttempt(before, toAttemptOutcome(result, false));
      if (next === before) return;

      const from = effectiveRank(before);
      const to = effectiveRank(next);
      setSettings(next);
      setRankChange(to === from ? null : { from, to, direction: to > from ? 'up' : 'down' });
      await deps.difficulty.save(next);
    },
    [deps.difficulty],
  );

  const speedNow = useCallback(() => deps.speed?.() ?? 1, [deps]);

  /**
   * Sound what the learner listens to before answering, again for as long as they ask to hear it from
   * the start. Resolves with how it ended: heard out, or cut short by Skip.
   */
  const listenThrough = useCallback(async (play: () => Promise<void>, current: () => boolean) => {
    // Read through a function: the ask is set from a button while `play` is awaited.
    const asked = (): 'none' | 'restart' | 'skip' => listenAskRef.current;
    for (;;) {
      listenAskRef.current = 'none';
      setPaused(false);
      await play();
      if (!current() || asked() !== 'restart') break;
    }
    setPaused(false);
    return asked() === 'skip' ? 'skipped' : 'heard';
  }, []);

  /** Play phrase `i` for the learner to answer, then hand over to them. */
  const playPhrase = useCallback(
    async (m: Melody, i: number) => {
      const token = tuneTokenRef.current;
      setListening('phrase');
      setPhase('playingMelody');
      await deps.session.enterPlayback();
      await listenThrough(
        () => playPhraseAt(deps.playback, m, i, speedNow()),
        () => tuneTokenRef.current === token,
      );
      if (tuneTokenRef.current !== token) return;
      setPhase('awaitingInput');
    },
    [deps, speedNow, listenThrough],
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

  /** Serve a new tune from `at`: play it whole, then its first phrase. */
  const serve = useCallback(
    async (at: DifficultyLevel) => {
      endReplay(false); // the new melody's playback cuts the old audio itself
      await historyRef.current; // pick against the full history, not a half-loaded one
      const m = deps.nextMelody(at, deps.seed(), masteredRef.current, recentRef.current);
      const token = ++tuneTokenRef.current;
      if (scored(m)) recentRef.current.push(tuneIdOf(m.id));
      setFails(0);
      setHint(null);
      firstGradesRef.current = [];
      firstAnswersRef.current = [];
      setMelody(m);
      setPhraseIndex(0);
      setPhraseGrades([]);
      setGrade(null);
      setTuneGrade(null);
      setRankChange(null);
      setAnswer([]);
      // A one-phrase tune is its own first phrase: no whole-tune intro to sit through first.
      if (phraseCount(m) === 1) {
        await playPhrase(m, 0);
        return;
      }
      setListening('tune');
      setPhase('playingMelody');
      await deps.session.enterPlayback();
      const ended = await listenThrough(
        () => playTuneAt(deps.playback, m, speedNow()),
        () => tuneTokenRef.current === token,
      );
      if (tuneTokenRef.current !== token) return;
      // A skipped intro goes straight on; one heard to the end gets a breath first.
      if (ended === 'heard') await pause(INTRO_GAP_MS);
      if (tuneTokenRef.current !== token) return;
      await playPhrase(m, 0);
    },
    [deps, endReplay, playPhrase, scored, speedNow, listenThrough],
  );

  const next = useCallback(() => serve(level), [serve, level]);

  /**
   * The way out of a wall the learner chose: one rank down (in whichever mode is in effect), saved,
   * and a new tune from there. A retry never lowers the rank by itself (FR-011a); this is asked for.
   */
  const easier = useCallback(async () => {
    const before = settingsRef.current;
    const rank = effectiveRank(before);
    if (rank > MIN_RANK) {
      const after =
        before.mode === 'fixed'
          ? { ...before, fixedRank: rank - 1 }
          : { ...before, adaptiveRank: rank - 1, streakKind: 'none' as const, streakCount: 0 };
      setSettings(after);
      await deps.difficulty.save(after);
    }
    await serve(getLevelByRank(Math.max(MIN_RANK, rank - 1)));
  }, [deps.difficulty, serve]);

  /**
   * Enough listening: cut short what is playing before the answer and move on — from the whole tune to
   * its first phrase, from a phrase straight to answering it.
   */
  const skipListening = useCallback(() => {
    if (phase !== 'playingMelody') return;
    listenAskRef.current = 'skip';
    deps.playback.stop().catch(() => undefined);
  }, [deps.playback, phase]);

  /** Hear what is playing before the answer again from its start. */
  const restartListening = useCallback(() => {
    if (phase !== 'playingMelody') return;
    listenAskRef.current = 'restart';
    deps.playback.stop().catch(() => undefined);
  }, [deps.playback, phase]);

  /** Hold what is playing before the answer where it is. */
  const pauseListening = useCallback(() => {
    if (phase !== 'playingMelody') return;
    deps.playback.pause();
    setPaused(true);
  }, [deps.playback, phase]);

  const resumeListening = useCallback(() => {
    if (phase !== 'playingMelody') return;
    deps.playback.resume();
    setPaused(false);
  }, [deps.playback, phase]);

  /** Sound the phrase again (FR-007) over the current screen — or the whole tune once it is done. */
  const replay = useCallback(async () => {
    if (!melody || (phase !== 'awaitingInput' && phase !== 'feedback' && phase !== 'complete'))
      return;
    const token = ++replayTokenRef.current;
    setReplaying(true);
    try {
      await deps.session.enterPlayback();
      if (phase === 'complete') await playTuneAt(deps.playback, melody, speedNow());
      else await playPhraseAt(deps.playback, melody, phraseIndex, speedNow());
    } finally {
      if (replayTokenRef.current === token) setReplaying(false);
    }
  }, [deps, melody, phase, phraseIndex, speedNow]);

  const stopReplay = useCallback(() => endReplay(true), [endReplay]);

  const retry = useCallback(() => {
    if (!melody) return;
    if (replaying) endReplay(true);
    // Clear the board and let the learner answer the same phrase again (FR-008).
    setGrade(null);
    setAnswer([]);
    setPhase('awaitingInput');
  }, [melody, replaying, endReplay]);

  /** Retry the phrase keeping the first `keep` notes placed (the ones that were right). */
  const retryKeeping = useCallback(
    (keep: number) => {
      const kept = answerRef.current.slice(0, Math.max(0, keep));
      retry();
      setAnswer(kept);
    },
    [retry],
  );

  /** Retry the phrase with its first note marked on the board. */
  const retryWithHint = useCallback(() => {
    if (!phrase) return;
    setHint(fingering(phrase.notes.map((n) => n.midi))[0] ?? null);
    retry();
  }, [phrase, retry]);

  /**
   * Put the whole phrase on the board, note by note in a playable line, ready to check: the learner
   * hears each by tapping and compares with Replay. Only a retry, so it never scores.
   */
  const revealAnswer = useCallback(
    (line?: readonly FretPosition[]) => {
      if (!melody || !phrase) return;
      if (replaying) endReplay(true);
      const at = (deps.now?.() ?? new Date()).getTime();
      const positions = line ?? fingering(phrase.notes.map((n) => n.midi));
      setGrade(null);
      setHint(null);
      setAnswer(positions.map((p, i) => makeTap(p, at + i * 300)));
      setPhase('awaitingInput');
    },
    [deps, melody, phrase, replaying, endReplay],
  );

  /** Close the tune: score it on the first tries, name it and play it whole. */
  const finishTune = useCallback(
    async (m: Melody) => {
      const result = combinePhraseGrades(m, firstGradesRef.current);
      setTuneGrade(result);
      setGrade(null);
      setAnswer([]);
      setPhase('complete');
      if (scored(m)) {
        completeAttempt(m, result, combinePhraseAnswers(firstAnswersRef.current));
        if (deps.adapts?.(m) ?? true) await adapt(result);
      }
      // The payoff: hear the whole tune just answered note by note.
      const token = ++replayTokenRef.current;
      setReplaying(true);
      try {
        await deps.session.enterPlayback();
        await playTuneAt(deps.playback, m, speedNow());
      } finally {
        if (replayTokenRef.current === token) setReplaying(false);
      }
    },
    [deps, adapt, completeAttempt, scored, speedNow],
  );

  /** From a phrase's result: on to the next phrase, or close the tune after the last. */
  const nextPhrase = useCallback(async () => {
    if (!melody || phase !== 'feedback') return;
    if (replaying) endReplay(true);
    // A phrase left unchecked never reaches here: feedback means its first try is recorded.
    if (phraseIndex + 1 >= phraseCount(melody)) {
      await finishTune(melody);
      return;
    }
    const i = phraseIndex + 1;
    setPhraseIndex(i);
    setGrade(null);
    setAnswer([]);
    setFails(0);
    setHint(null);
    await playPhrase(melody, i);
  }, [melody, phase, phraseIndex, replaying, endReplay, finishTune, playPhrase]);

  /** Sound the tapped fret and add it to the answer (up to the phrase's length). */
  const tapFret = useCallback(
    (position: FretPosition) => {
      if (phase !== 'awaitingInput' || !phrase) return;
      // Tapping means the learner has heard enough: the tone below cuts the replay's audio.
      if (replaying) endReplay(false);
      const tap = makeTap(position, (deps.now?.() ?? new Date()).getTime());
      // Hearing the note is the point — it is how the learner compares it with the melody. It plays
      // even when the answer is already full, so a slot can be auditioned before undoing.
      deps.playback.playReferenceTone(tap.midi).catch(() => undefined);
      const cap = phrase.notes.length;
      setAnswer((prev) =>
        prev.length >= cap && deps.tapReplacesLast
          ? [...prev.slice(0, -1), tap]
          : addTap(prev, tap, cap),
      );
    },
    [deps, phase, phrase, replaying, endReplay],
  );

  /**
   * Draft mode (spec 008): sound the tapped fret and nothing else — the answer, grade and progress
   * never see it. Like an answer tap, it cuts a replay so the note can be compared with the melody.
   */
  const playFret = useCallback(
    (position: FretPosition) => {
      if (phase !== 'awaitingInput') return;
      if (replaying) endReplay(false);
      deps.playback.playReferenceTone(fretMidi(position)).catch(() => undefined);
    },
    [deps, phase, replaying, endReplay],
  );

  const undoFret = useCallback(() => setAnswer((prev) => undoTap(prev)), []);
  const clearFrets = useCallback(() => setAnswer([]), []);

  /** Grade the phrase as answered ("Check"). Needs at least one note. */
  const submitAnswer = useCallback(async () => {
    const taps = answerRef.current;
    if (phase !== 'awaitingInput' || !melody || !phrase || taps.length === 0) return;
    if (replaying) endReplay(true);
    setPhase('grading');
    const detected = tapsToDetected(taps);
    const result = gradeAttempt(phrase, detected, deps.gradingCfg);
    const first = firstGradesRef.current[phraseIndex] === undefined;
    if (first) {
      firstGradesRef.current[phraseIndex] = result;
      firstAnswersRef.current[phraseIndex] = detected;
      setPhraseGrades([...firstGradesRef.current]);
    }
    if (result.verdict !== 'correct') setFails((n) => n + 1);
    setGrade(result);
    setPhase('feedback');
    deps.onPhraseChecked?.({
      phrase: phraseIndex,
      phrases: phraseCount(melody),
      grade: result,
      first,
      melodyId: melody.id,
      level: melody.difficultyId,
    });
  }, [deps, phase, melody, phrase, phraseIndex, replaying, endReplay]);

  return useMemo(
    () => ({
      phase,
      listening,
      paused,
      replaying,
      answer,
      melody,
      phrase,
      phraseIndex,
      phrases,
      phraseGrades,
      grade,
      tuneGrade,
      level,
      settings,
      rankChange,
      fails,
      hint,
      next,
      easier,
      skipListening,
      restartListening,
      pauseListening,
      resumeListening,
      replay,
      stopReplay,
      retry,
      retryKeeping,
      retryWithHint,
      revealAnswer,
      nextPhrase,
      tapFret,
      playFret,
      undoFret,
      clearFrets,
      submitAnswer,
    }),
    [
      phase,
      listening,
      paused,
      replaying,
      answer,
      melody,
      phrase,
      phraseIndex,
      phrases,
      phraseGrades,
      grade,
      tuneGrade,
      level,
      settings,
      rankChange,
      fails,
      hint,
      next,
      easier,
      skipListening,
      restartListening,
      pauseListening,
      resumeListening,
      replay,
      stopReplay,
      retry,
      retryKeeping,
      retryWithHint,
      revealAnswer,
      nextPhrase,
      tapFret,
      playFret,
      undoFret,
      clearFrets,
      submitAnswer,
    ],
  );
}
