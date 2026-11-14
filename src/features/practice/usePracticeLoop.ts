// Practice-loop state machine (T028, US1; spec 014). A tune is learnt phrase by phrase:
//   idle → for each phrase: awaitingInput (the phrase plays at once, board live) → grading → feedback
//   → (retry | next phrase) → complete (the tune is named, summed up and played whole) → next tune.
// A phrase fits in the ear's working memory where a 60-note tune does not, and the tune stays whole:
// the whole tune can be heard on request while answering the first phrase, and is played in full at the
// end. The coached first melody (`listenFirst`) keeps a listening phase of its own (`playingMelody`).
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
import { noteTimeline, resumable } from '../../lib/noteRow';
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
  replaceTap,
  tapsToDetected,
  undoTap,
} from '../../lib/fretboard';
import { fingering } from '../../lib/hints';
import {
  PhraseSave,
  detectedFromSave,
  gradeFromSave,
  resumePhrase,
  savesFrom,
  skipTarget,
} from '../../lib/melodyProgress';

export type LoopPhase =
  'idle' | 'playingMelody' | 'awaitingInput' | 'grading' | 'feedback' | 'complete';

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
   * Where an earlier visit stopped in the tune just picked (spec 017): the first tries already made, and the
   * phrase to open at. They are restored as this visit's first tries, so the melody is scored on all of them.
   */
  resumeOf?: (m: Melody) => { saves: PhraseSave[]; startPhrase: number } | null;
  /** The first try at a phrase was made: the answered phrases so far, to save as the place to continue at. */
  onProgress?: (m: Melody, saves: PhraseSave[]) => void;
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
  /**
   * Listen to each phrase on its own screen (`playingMelody`) before the answer opens — the coached first
   * melody. Default off: the phrase plays on the answer screen itself, the board already live.
   */
  listenFirst?: boolean;
  /** Injected for testability; defaults to wall-clock time. */
  now?: () => Date;
}

/** A rank movement to surface when a tune is done, so difficulty never shifts silently. */
export interface RankChange {
  from: number;
  to: number;
  direction: 'up' | 'down';
}

/** What a replay sounds: a phrase, or the whole tune. */
export type SoundKind = 'phrase' | 'tune';

/** A replay stopped part-way (spec 021): which it was and how far in, in ms at the tune's own tempo. */
export interface PausedPlace {
  kind: SoundKind;
  ms: number;
}

/**
 * Sound the whole tune at `speed` × its own tempo: schedule and clip both slow down, pitch stays.
 * `offsetMs` picks it up that far in (a paused tune).
 */
function playTuneAt(
  playback: AudioPlayback,
  m: Melody,
  speed: number,
  offsetMs = 0,
): Promise<void> {
  return playback.playMelody(
    scheduleMelody(m, m.tempoBpm * speed),
    tuneIdOf(m.id),
    speed,
    undefined,
    offsetMs,
  );
}

/** Sound phrase `i` of the tune, out of the tune's own clip, from `offsetMs` into the phrase. */
function playPhraseAt(
  playback: AudioPlayback,
  m: Melody,
  i: number,
  speed: number,
  offsetMs = 0,
): Promise<void> {
  const fromMs = phraseStartBeats(m, i) * beatMs(m.tempoBpm);
  return playback.playMelody(
    scheduleMelody(phraseMelody(m, i), m.tempoBpm * speed),
    tuneIdOf(m.id),
    speed,
    fromMs,
    offsetMs,
  );
}

export function usePracticeLoop(deps: PracticeLoopDeps) {
  const [phase, setPhase] = useState<LoopPhase>('idle');
  const [melody, setMelody] = useState<Melody | null>(null);
  // The phrase an earlier visit stopped at, while this visit has not got there: "Skip to phrase N" goes to it.
  const [savedPhrase, setSavedPhrase] = useState<number | null>(null);
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
  // A placed note chosen for replacement (spec 021): the next fret tap goes there instead of at the end.
  const [cursor, setCursor] = useState<number | null>(null);
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  // A replay is sounding. Kept apart from `phase` so replaying never swaps the screen.
  const [replaying, setReplaying] = useState(false);
  // A replay the learner paused: where to pick it up (spec 021). Gone as soon as anything else sounds, the
  // phrase changes or the answer is checked.
  const [paused, setPaused] = useState<PausedPlace | null>(null);
  // What the replay sounding now is, so a pause knows which timeline its position belongs to.
  const soundingRef = useRef<SoundKind>('phrase');
  // Failed checks on the phrase on screen: enough of them and help is offered (lib/hints).
  const [fails, setFails] = useState(0);
  // Where the phrase's first note lives, once the learner asked for it.
  const [hint, setHint] = useState<FretPosition | null>(null);
  // Bumped whenever a replay ends early (stop, a tap, check, next): a clip's promise resolves on its
  // own clock, so a replay only clears the flag if nothing has superseded it meanwhile.
  const replayTokenRef = useRef(0);
  // Bumped by each new tune: a tune's intro → first phrase hand-over only runs if it is still current.
  const tuneTokenRef = useRef(0);
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

  // The learner's level is known: the first tune is served at it, not at the default.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    deps.difficulty
      .load()
      .then((loaded) => {
        if (!cancelled) setSettings(loaded);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
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

  /** Sound `play` over the current screen as a replay: `replaying` is true until it ends, or is superseded. */
  const sound = useCallback(
    async (kind: SoundKind, play: () => Promise<void>) => {
      const token = ++replayTokenRef.current;
      soundingRef.current = kind;
      setPaused(null);
      setReplaying(true);
      try {
        await deps.session.enterPlayback();
        await play();
      } finally {
        if (replayTokenRef.current === token) setReplaying(false);
      }
    },
    [deps.session],
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

  /**
   * Hand phrase `i` to the learner and sound it. By default the answer opens at once and the phrase plays on
   * it (a tap or Check cuts it, like any replay); with `listenFirst` it is listened to on its own first.
   */
  const playPhrase = useCallback(
    async (m: Melody, i: number) => {
      if (!deps.listenFirst) {
        setPhase('awaitingInput');
        await sound('phrase', () => playPhraseAt(deps.playback, m, i, speedNow()));
        return;
      }
      const token = tuneTokenRef.current;
      setPhase('playingMelody');
      await deps.session.enterPlayback();
      await playPhraseAt(deps.playback, m, i, speedNow());
      if (tuneTokenRef.current !== token) return;
      setPhase('awaitingInput');
    },
    [deps, sound, speedNow],
  );

  /** Serve a new tune from `at`: straight to its first phrase. */
  const serve = useCallback(
    async (at: DifficultyLevel) => {
      endReplay(false); // the new melody's playback cuts the old audio itself
      await historyRef.current; // pick against the full history, not a half-loaded one
      const m = deps.nextMelody(at, deps.seed(), masteredRef.current, recentRef.current);
      tuneTokenRef.current += 1; // a new tune: anything still queued for the old one must not run
      if (scored(m)) recentRef.current.push(tuneIdOf(m.id));
      setFails(0);
      setHint(null);
      const resume = deps.resumeOf?.(m);
      const saves = resume?.saves ?? [];
      firstGradesRef.current = saves.map(gradeFromSave);
      firstAnswersRef.current = saves.map(detectedFromSave);
      const first = resume ? Math.min(Math.max(0, resume.startPhrase), phraseCount(m) - 1) : 0;
      setMelody(m);
      setSavedPhrase(saves.length > 0 ? resumePhrase(saves.length, phraseCount(m)) : null);
      setPhraseIndex(first);
      setPhraseGrades([...firstGradesRef.current]);
      setGrade(null);
      setTuneGrade(null);
      setRankChange(null);
      setAnswer([]);
      await playPhrase(m, first);
    },
    [deps, endReplay, playPhrase, scored, speedNow],
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

  /** Sound the phrase again (FR-007) over the current screen — or the whole tune once it is done. */
  const replay = useCallback(async () => {
    if (!melody || (phase !== 'awaitingInput' && phase !== 'feedback' && phase !== 'complete'))
      return;
    await sound(phase === 'complete' ? 'tune' : 'phrase', () =>
      phase === 'complete'
        ? playTuneAt(deps.playback, melody, speedNow())
        : playPhraseAt(deps.playback, melody, phraseIndex, speedNow()),
    );
  }, [deps.playback, sound, melody, phase, phraseIndex, speedNow]);

  /** Hear the whole tune while answering its first phrase: it replaces what is sounding. */
  const hearWhole = useCallback(async () => {
    if (!melody || phase !== 'awaitingInput') return;
    await sound('tune', () => playTuneAt(deps.playback, melody, speedNow()));
  }, [deps.playback, sound, melody, phase, speedNow]);

  /** Jump ahead to the phrase an earlier visit stopped at, from an earlier phrase before a note is placed. */
  const skipToSaved = useCallback(async () => {
    if (!melody || savedPhrase === null || phase !== 'awaitingInput') return;
    const target = skipTarget(phraseIndex, savedPhrase);
    if (target === null) return;
    setPhraseIndex(target);
    setGrade(null);
    setAnswer([]);
    setFails(0);
    setHint(null);
    await playPhrase(melody, target);
  }, [melody, savedPhrase, phase, phraseIndex, playPhrase]);

  const stopReplay = useCallback(() => endReplay(true), [endReplay]);

  /** Keep `where` (ms into what sounded) as the place to pick up from, unless too little is left to play. */
  const remember = useCallback(
    (where: number | null) => {
      if (where === null || !melody) return;
      const kind = soundingRef.current;
      const total = noteTimeline(kind === 'tune' ? melody : phraseMelody(melody, phraseIndex)).totalMs;
      if (resumable(where, total)) setPaused({ kind, ms: where });
    },
    [melody, phraseIndex],
  );

  /** Silence the replay where it is and keep the place (the row's ⏸, or a touch on the row). */
  const pause = useCallback(() => {
    if (!replaying) return;
    const where = deps.playback.pause();
    endReplay(false);
    remember(where);
  }, [deps.playback, replaying, endReplay, remember]);

  /** Carry on from the paused place, at the speed in effect now. */
  const resume = useCallback(async () => {
    const place = paused;
    if (!melody || !place) return;
    await sound(place.kind, () =>
      place.kind === 'tune'
        ? playTuneAt(deps.playback, melody, speedNow(), place.ms)
        : playPhraseAt(deps.playback, melody, phraseIndex, speedNow(), place.ms),
    );
  }, [deps.playback, sound, melody, paused, phraseIndex, speedNow]);

  /** Play the phrase from note `index` (a tap or the release of a drag on the note row). */
  const seek = useCallback(
    async (index: number) => {
      if (!melody || !phrase || phase !== 'awaitingInput') return;
      const { starts } = noteTimeline(phrase);
      const ms = starts[Math.min(Math.max(0, Math.round(index)), starts.length - 1)] ?? 0;
      // Landing on a placed note selects it for replacement; past the last one there is nothing to replace.
      setCursor(index < answerRef.current.length ? index : null);
      await sound('phrase', () => playPhraseAt(deps.playback, melody, phraseIndex, speedNow(), ms));
    },
    [deps.playback, sound, melody, phrase, phase, phraseIndex, speedNow],
  );

  /** Where a replay sounding now is, for the note row (ms into the phrase or tune; null when none). */
  const position = useCallback(() => deps.playback.position(), [deps.playback]);

  /** A tap or another sound takes over a replay: what it had not yet played stays available to resume. */
  const suspend = useCallback(() => {
    const where = deps.playback.position();
    endReplay(false);
    remember(where);
  }, [deps.playback, endReplay, remember]);

  // The place belongs to the phrase and screen it was paused on.
  useEffect(() => {
    setPaused(null);
    setCursor(null);
  }, [melody, phraseIndex, phase]);

  const timeline = useMemo(() => (phrase ? noteTimeline(phrase) : null), [phrase]);

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
      await sound('tune', () => playTuneAt(deps.playback, m, speedNow()));
    },
    [deps, sound, adapt, completeAttempt, scored, speedNow],
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
      // Tapping means the learner has heard enough for now: the tone below cuts the replay's audio, and
      // the place stays so it can be picked up again.
      if (replaying) suspend();
      const tap = makeTap(position, (deps.now?.() ?? new Date()).getTime());
      // Hearing the note is the point — it is how the learner compares it with the melody. It plays
      // even when the answer is already full, so a slot can be auditioned before undoing.
      deps.playback.playReferenceTone(tap.midi).catch(() => undefined);
      const cap = phrase.notes.length;
      setAnswer((prev) => {
        const at = cursorRef.current;
        if (at !== null && at < prev.length) return replaceTap(prev, at, tap);
        return prev.length >= cap && deps.tapReplacesLast
          ? [...prev.slice(0, -1), tap]
          : addTap(prev, tap, cap);
      });
      setCursor(null);
    },
    [deps, phase, phrase, replaying, suspend],
  );

  /**
   * Draft mode (spec 008): sound the tapped fret and nothing else — the answer, grade and progress
   * never see it. Like an answer tap, it cuts a replay so the note can be compared with the melody.
   */
  const playFret = useCallback(
    (position: FretPosition) => {
      if (phase !== 'awaitingInput') return;
      if (replaying) suspend();
      deps.playback.playReferenceTone(fretMidi(position)).catch(() => undefined);
    },
    [deps, phase, replaying, suspend],
  );

  const undoFret = useCallback(() => {
    setAnswer((prev) => undoTap(prev));
    setCursor(null);
  }, []);
  const clearFrets = useCallback(() => {
    setAnswer([]);
    setCursor(null);
  }, []);

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
      deps.onProgress?.(melody, savesFrom(firstGradesRef.current, firstAnswersRef.current));
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
      ready,
      replaying,
      paused,
      timeline,
      cursor,
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
      replay,
      hearWhole,
      skipToSaved,
      savedPhrase,
      stopReplay,
      pause,
      resume,
      seek,
      position,
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
      ready,
      replaying,
      paused,
      timeline,
      cursor,
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
      pause,
      resume,
      seek,
      position,
      next,
      easier,
      replay,
      hearWhole,
      skipToSaved,
      savedPhrase,
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
