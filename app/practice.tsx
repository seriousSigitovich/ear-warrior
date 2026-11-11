// Practice screen (T034): wires the practice loop to transport controls and feedback (US1).
// Redesigned onto Nocturne: a Practice/Level header, a per-phase stage, and feedback rendered
// as a verdict card + note chips (with a non-blocking tuning advisory) or a calm retry state.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Session } from '../src/models';
import { curatedMelody, historyFromAttempts } from '../src/services/melody/curated';
import { catalogTune } from '../src/services/melody/catalog';
import { DEFAULT_GRADING_CFG } from '../src/services/grading/grade';
import { MAX_RANK, MIN_RANK, getLevel, getLevelByRank } from '../src/services/melody/levels';
import { scoreOf } from '../src/lib/review';
import { getGamification } from '../src/services/gamification/instance';
import { CompletionResult, Snapshot } from '../src/services/gamification/service';
import { completionEvents, GameEvent, phraseEvents } from '../src/services/gamification/events';
import { gameSummary } from '../src/services/gamification/summary';
import { RankUpModal } from '../src/components/gamification/RankUpModal';
import { FretPosition, fretMidi, tapStatuses } from '../src/lib/fretboard';
import {
  DraftState,
  draftPhraseChecked,
  draftPhraseStarted,
  initialDraft,
  toggleDraft,
} from '../src/lib/draft';
import { shouldOfferHelp } from '../src/lib/hints';
import { createAudioPlayback } from '../src/services/audio/playback';
import { createAudioSession } from '../src/services/audio/session';
import { KEY_VALUE_TABLE, defaultRowStore } from '../src/services/storage/db';
import {
  createAttemptRepository,
  createMelodyRepository,
  createSessionRepository,
} from '../src/services/storage/repositories';
import {
  createAttemptLogOutbox,
  createNullAttemptLogClient,
  defaultAttemptLogClient,
} from '../src/services/logging/attemptLog';
import { createProgressClient } from '../src/services/progress/client';
import { createProgressOutbox } from '../src/services/progress/outbox';
import { getDifficultyRepository } from '../src/features/difficulty/difficultyRepository';
import { getAuthService } from '../src/features/auth/authService';
import { getOrCreateDeviceId, keyValueOverRowStore } from '../src/lib/deviceId';
import { setPhase, track } from '../src/features/analytics/tracker';
import { PracticeLoopDeps, usePracticeLoop } from '../src/features/practice/usePracticeLoop';
import { persistGradedAttempt } from '../src/features/practice/persist';
import { useSession } from '../src/features/practice/session';
import { Screen } from '../src/components/common/Screen';
import { Kicker } from '../src/components/common/Kicker';
import { Tag } from '../src/components/common/Tag';
import { TransportControls } from '../src/components/controls/TransportControls';
import { FretboardControls } from '../src/components/controls/FretboardControls';
import { SpeedSlider } from '../src/components/controls/SpeedSlider';
import { DEFAULT_SPEED, SPEED_KEY, parseSpeed } from '../src/lib/speed';
import { PracticeStage } from '../src/components/practice/PracticeStage';
import { PhraseProgress } from '../src/components/practice/PhraseProgress';
import { TuneComplete } from '../src/components/feedback/TuneComplete';
import { FretboardAnswer } from '../src/components/practice/FretboardAnswer';
import { Fretboard } from '../src/components/fretboard/Fretboard';
import { VerdictBanner } from '../src/components/feedback/VerdictBanner';
import { NoteResultChips } from '../src/components/feedback/NoteResultChips';
import { RankChangeBanner } from '../src/components/feedback/RankChangeBanner';
import { StuckHelp } from '../src/components/feedback/StuckHelp';

const APP_VERSION = '0.1.0';

/** Every pitch the fretboard can sound (E2–E5), rendered ahead of time so a tap plays at once. */
const FRETBOARD_MIDI = Array.from({ length: 37 }, (_, i) => 40 + i);

/** Fret height on the result view, where the board sits in a scrolling column. */
const RESULT_FRET_HEIGHT = 26;

// Backend base URL (Node/Postgres). Absent in a build without it → telemetry and progress are no-ops
// and the app stays fully offline.
const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function Practice() {
  // A tune picked from the library (`/practice?tune=<id>`): it is served first, whatever the level in
  // effect; after it practice carries on as usual. An unknown id is ignored.
  const { tune: tuneParam } = useLocalSearchParams<{ tune?: string }>();
  const picked = useMemo(() => (tuneParam ? catalogTune(tuneParam) : null), [tuneParam]);
  const pickedPending = useRef(picked !== null);
  // Melody ids served as picks: recorded like any tune, but they do not move the difficulty rank.
  const pickedMelodies = useRef(new Set<string>());
  // Rewards (spec 013): the service decides every one; this screen reports a phrase checked and a melody
  // completed, shows what comes back, and sends the events that came with it.
  const game = useMemo(() => getGamification(), []);
  // XP each phrase paid during this visit, keyed `<melody id>:<phrase>`, for the result and the closing card.
  const [phraseXp, setPhraseXp] = useState<Record<string, number>>({});
  // The melody finished last: its completion (null when below the pass mark) and the standing after it.
  const [finished, setFinished] = useState<{
    melodyId: string;
    result: CompletionResult | null;
    snap: Snapshot | null;
  } | null>(null);
  const [rankUpName, setRankUpName] = useState<string | null>(null);
  // Helps (first note, show answer) taken during the melody on screen: mastery counts melodies without any.
  const melodyHelps = useRef(0);
  const emit = useCallback((events: GameEvent[]) => {
    for (const e of events) track(e.name, e.props);
  }, []);
  // Which help, if any, the learner took on the phrase on screen: rides along on its next check.
  const helpRef = useRef<string>('none');
  // Draft mode (spec 008): on/off for this visit, and whether it was used on the phrase on screen. The
  // ref is what the loop's callbacks read; the state is what renders.
  const [draft, setDraftState] = useState<DraftState>(initialDraft);
  const draftRef = useRef(draft);
  const setDraft = useCallback((next: DraftState) => {
    draftRef.current = next;
    setDraftState(next);
  }, []);
  // The last draft tap, flashed on the board.
  const [flash, setFlash] = useState<{ position: FretPosition; id: number; midi: number } | null>(
    null,
  );
  // One durable store shared by every repository, and one session per visit to this screen.
  const store = useMemo(() => defaultRowStore(), []);
  const repos = useMemo(
    () => ({
      sessions: createSessionRepository(store),
      attempts: createAttemptRepository(store),
      melodies: createMelodyRepository(store),
    }),
    [store],
  );
  const sessionId = useMemo(() => `s_${Date.now()}`, []);
  const outbox = useMemo(
    () => createAttemptLogOutbox(defaultAttemptLogClient(API_URL) ?? createNullAttemptLogClient()),
    [],
  );
  // The signed-in learner's progress lives on the backend; null in a build without one. Practice itself
  // never needs it: anonymous learners and a dead network just use the local record.
  const progress = useMemo(() => {
    const client = createProgressClient(API_URL);
    if (!client) return null;
    const getToken = () => getAuthService().getToken();
    const outbox = createProgressOutbox({
      client,
      getToken,
      kv: keyValueOverRowStore(store, KEY_VALUE_TABLE),
      getAttempt: (id) => repos.attempts.get(id),
    });
    return { client, getToken, outbox };
  }, [store, repos.attempts]);
  const difficulty = getDifficultyRepository();
  const [deviceId, setDeviceId] = useState<string | null>(null);

  // Playback speed: remembered between visits, read by the loop at each play through a ref (so moving
  // the slider never rebuilds the loop), applied at once to a melody already sounding, and sent with
  // the play/check events.
  const kv = useMemo(() => keyValueOverRowStore(store, KEY_VALUE_TABLE), [store]);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  useEffect(() => {
    void kv
      .getItem(SPEED_KEY)
      .then((stored) => setSpeed(parseSpeed(stored)))
      .catch(() => undefined);
  }, [kv]);

  // Create the Session row up front so attempts always have a parent (FR-018).
  useEffect(() => {
    const session: Session = {
      id: sessionId,
      startedAt: new Date().toISOString(),
      endedAt: null,
      difficultyMode: 'adaptive',
      currentDifficultyId: '',
      attemptCount: 0,
      accuracyPct: 0,
    };
    void repos.sessions.create(session);
    void getOrCreateDeviceId(keyValueOverRowStore(store, KEY_VALUE_TABLE)).then(setDeviceId);
  }, [repos.sessions, sessionId, store]);

  // Send what an earlier visit could not (offline, app killed before the post finished).
  useEffect(() => {
    void progress?.outbox.flush();
  }, [progress]);

  /** What the next melody is picked against: the account's history when signed in, else this device's. */
  const loadHistory = useCallback(async () => {
    const token = progress ? await progress.getToken() : null;
    const remote = progress && token ? await progress.client.history(token) : null;
    return remote ?? historyFromAttempts(await repos.attempts.all());
  }, [progress, repos.attempts]);

  const session = useSession(sessionId, repos.sessions);
  // `end` is stable enough to run on unmount; ending is idempotent (`ended` is terminal).
  const endSession = session.end;
  useEffect(() => () => endSession(), [endSession]);

  // Beta analytics: one start/end pair per visit to this screen. The end reads the tally through a ref
  // because the cleanup closes over the first render's state.
  const attemptCountRef = useRef(0);
  attemptCountRef.current = session.state.attemptCount;
  useEffect(() => {
    const startedAt = Date.now();
    track('session_start');
    return () =>
      track('session_end', {
        attempt_count: attemptCountRef.current,
        duration_s: Math.round((Date.now() - startedAt) / 1000),
      });
  }, []);

  const playback = useMemo(() => createAudioPlayback(), []);
  // The level in effect, for events sent from inside the loop's callbacks.
  const rankRef = useRef(1);

  const changeSpeed = useCallback(
    (next: number) => {
      setSpeed(next);
      playback.setRate(next); // the melody sounding now, if any, follows the slider
      void kv.setItem(SPEED_KEY, String(next)).catch(() => undefined);
    },
    [kv, playback],
  );

  // Tap-to-hear must not stutter: materialize the tones once the screen has settled.
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void playback.preload(FRETBOARD_MIDI).catch(() => undefined);
    });
    return () => task.cancel();
  }, [playback]);

  const deps = useMemo<PracticeLoopDeps>(
    () => ({
      nextMelody: (level, seed, mastered, recent) => {
        if (picked && pickedPending.current) {
          pickedPending.current = false;
          const m = curatedMelody(getLevelByRank(picked.rank), seed, picked.id);
          pickedMelodies.current.add(m.id);
          return m;
        }
        return curatedMelody(level, seed, undefined, mastered, recent);
      },
      adapts: (m) => !pickedMelodies.current.has(m.id),
      loadHistory,
      playback,
      session: createAudioSession(),
      gradingCfg: DEFAULT_GRADING_CFG,
      seed: () => Math.floor(Math.random() * 1e9),
      difficulty,
      speed: () => speedRef.current,
      sessionId,
      onAttemptGraded: (attempt, melody, level) => {
        // Every attempt is recorded (FR-012), moves the session tally, and goes up to the backend
        // on its own: the outbox keeps it until the server has it.
        void persistGradedAttempt(attempt, melody, level, {
          attempts: repos.attempts,
          melodies: repos.melodies,
          outbox,
          appVersion: APP_VERSION,
          deviceId: deviceId ?? 'dev_pending',
        })
          .then(() => progress?.outbox.enqueue(attempt))
          .catch(() => undefined);
        session.recordAttempt(attempt.verdict === 'correct');
        // The melody is done: it counts as an exercise when enough of it was landed.
        void game
          .exerciseCompleted({
            id: attempt.id,
            melodyId: melody.id,
            level: melody.difficultyId,
            accuracy: scoreOf(attempt.noteResults).pct,
            hintsUsed: melodyHelps.current,
          })
          .then(async (result) => {
            if (result) {
              emit(completionEvents(result));
              if (result.rankUp) setRankUpName(result.rankUp);
            }
            setFinished({ melodyId: melody.id, result, snap: await game.snapshot() });
          })
          .catch(() => undefined);
      },
      // One check per phrase. `n` is the tune of this visit it belongs to, `first` marks the try the
      // tune is scored on.
      onPhraseChecked: ({ phrase, phrases, grade, first, melodyId: playId, level: levelId }) => {
        const checked = draftPhraseChecked(draftRef.current);
        setDraft(checked.state);
        track('answer_check', {
          verdict: grade.verdict,
          rank: rankRef.current,
          n: attemptCountRef.current + 1,
          speed: speedRef.current,
          phrase: phrase + 1,
          phrases,
          first,
          help: helpRef.current,
          draft: checked.draft,
        });
        // A phrase landed well enough pays XP, once per phrase per play.
        void game
          .phraseChecked({
            melodyId: playId,
            phrase,
            accuracy: scoreOf(grade.noteResults).pct,
            level: levelId,
            answerShown: helpRef.current === 'answer',
          })
          .then((award) => {
            if (!award) return;
            setPhraseXp((prev) => ({ ...prev, [`${playId}:${phrase}`]: award.xp }));
            emit(phraseEvents(award));
            if (award.rankUp) setRankUpName(award.rankUp);
          })
          .catch(() => undefined);
      },
    }),
    [
      playback,
      repos,
      difficulty,
      loadHistory,
      progress,
      sessionId,
      outbox,
      deviceId,
      session,
      setDraft,
      picked,
      game,
      emit,
    ],
  );

  const loop = usePracticeLoop(deps);
  rankRef.current = loop.level.rank;

  const phraseKey = `${loop.melody?.id}:${loop.phraseIndex}`;
  useEffect(() => {
    helpRef.current = 'none';
    setDraft(draftPhraseStarted(draftRef.current));
  }, [phraseKey, setDraft]);
  const loopRetryWithHint = loop.retryWithHint;
  const loopRevealAnswer = loop.revealAnswer;
  const showFirstNote = useCallback(() => {
    helpRef.current = 'first_note';
    melodyHelps.current += 1;
    loopRetryWithHint();
  }, [loopRetryWithHint]);
  const showAnswer = useCallback(() => {
    helpRef.current = 'answer';
    melodyHelps.current += 1;
    loopRevealAnswer();
  }, [loopRevealAnswer]);
  const currentMelodyId = loop.melody?.id;
  useEffect(() => {
    melodyHelps.current = 0; // a new melody starts without helps taken
  }, [currentMelodyId]);

  // Funnel analytics inside the loop: heard a melody → started tapping → checked (`answer_check` above).
  // The phase rides along on `app_background`, so a leave mid-answer shows as such.
  useEffect(() => setPhase(loop.phase), [loop.phase]);
  const rank = loop.level.rank;
  const melodyId = loop.melody?.id;
  // Keyed on the melody alone: once per melody, not again when the level changes under it.
  useEffect(() => {
    if (melodyId) track('melody_play', { rank, speed: speedRef.current });
  }, [melodyId]);
  const tappedMelody = useRef<string | null>(null);
  const tapped = loop.phase === 'awaitingInput' && loop.answer.length > 0;
  useEffect(() => {
    if (!tapped || !melodyId || tappedMelody.current === melodyId) return;
    tappedMelody.current = melodyId; // once per melody, however often the answer is cleared
    track('answer_start', { rank });
  }, [tapped, melodyId, rank]);
  // How often a melody is heard again before Check (`where` tells answering from the result view).
  const replays = useRef({ melodyId: '', n: 0 });
  const loopReplay = loop.replay;
  const replay = useCallback(() => {
    if (!melodyId) return;
    if (replays.current.melodyId !== melodyId) replays.current = { melodyId, n: 0 };
    replays.current.n += 1;
    track('melody_replay', {
      rank,
      n: replays.current.n,
      where: loop.phase,
      speed: speedRef.current,
    });
    void loopReplay();
  }, [melodyId, rank, loop.phase, loopReplay]);

  // Hearing the whole melody on request counts as a replay too (`where` tells them apart).
  const loopHearWhole = loop.hearWhole;
  const hearWhole = useCallback(() => {
    if (!melodyId) return;
    if (replays.current.melodyId !== melodyId) replays.current = { melodyId, n: 0 };
    replays.current.n += 1;
    track('melody_replay', {
      rank,
      n: replays.current.n,
      where: 'whole',
      speed: speedRef.current,
    });
    void loopHearWhole();
  }, [melodyId, rank, loopHearWhole]);

  // Practice starts playing by itself (spec 014): once the learner's level is loaded, serve a melody. If
  // that fails, the idle screen keeps its Play melody button so nobody is stuck.
  const autoStarted = useRef(false);
  const [startFailed, setStartFailed] = useState(false);
  const loopNext = loop.next;
  useEffect(() => {
    if (!loop.ready || autoStarted.current) return;
    autoStarted.current = true;
    loopNext().catch(() => setStartFailed(true));
  }, [loop.ready, loopNext]);

  // The level of the tune on screen: a picked tune need not be on the rank in effect.
  const shownRank = loop.melody
    ? getLevel(loop.melody.difficultyId).rank
    : picked && pickedPending.current
      ? picked.rank
      : loop.level.rank;
  // What the tune just finished earned: its phrases' XP plus the completion's challenge rewards.
  const summary = useMemo(() => {
    if (!loop.melody || finished?.melodyId !== loop.melody.id) return null;
    const prefix = `${loop.melody.id}:`;
    const fromPhrases = Object.entries(phraseXp)
      .filter(([key]) => key.startsWith(prefix))
      .reduce((sum, [, xp]) => sum + xp, 0);
    return gameSummary(fromPhrases, finished.result, finished.snap);
  }, [loop.melody, finished, phraseXp]);

  const grade = loop.grade;
  const showFeedback = loop.phase === 'feedback' && !!grade;
  const complete = loop.phase === 'complete';
  const answering = loop.phase === 'awaitingInput';
  const noteCount = loop.phrase?.notes.length ?? 0;
  const stuck = showFeedback && grade!.verdict !== 'correct' && shouldOfferHelp(loop.fails);

  // A flash belongs to the board it was tapped on: gone once the answer view closes.
  useEffect(() => {
    if (!answering) setFlash(null);
  }, [answering]);
  const phraseNo = loop.phraseIndex + 1;
  const phraseTotal = loop.phrases;
  const switchDraft = useCallback(() => {
    const toggled = toggleDraft(draftRef.current);
    setDraft(toggled.state);
    if (!toggled.state.on) setFlash(null);
    if (toggled.track) track('draft_on', { rank, phrase: phraseNo, phrases: phraseTotal });
  }, [setDraft, rank, phraseNo, phraseTotal]);
  // Draft taps only sound (and flash); everything else goes to the answer as before.
  const loopTapFret = loop.tapFret;
  const loopPlayFret = loop.playFret;
  const tapFret = useCallback(
    (position: FretPosition) => {
      if (!draftRef.current.on) {
        loopTapFret(position);
        return;
      }
      loopPlayFret(position);
      setFlash((prev) => ({ position, id: (prev?.id ?? 0) + 1, midi: fretMidi(position) }));
    },
    [loopTapFret, loopPlayFret],
  );

  return (
    <Screen edges={['bottom']}>
      {answering ? null : (
        <View style={styles.header}>
          <Kicker>Practice</Kicker>
          <Tag label={`Level ${shownRank} of ${MAX_RANK}`} />
        </View>
      )}

      {loop.melody && loop.phase !== 'idle' ? (
        <PhraseProgress
          phrases={loop.phrases}
          index={loop.phraseIndex}
          grades={loop.phraseGrades}
          stage={complete ? 'done' : 'phrase'}
        />
      ) : null}

      {complete ? (
        <ScrollView contentContainerStyle={styles.feedback} showsVerticalScrollIndicator={false}>
          <TuneComplete
            title={loop.melody?.title}
            grades={loop.phraseGrades}
            results={loop.tuneGrade?.noteResults}
            game={summary}
          />
          {loop.rankChange ? <RankChangeBanner change={loop.rankChange} /> : null}
        </ScrollView>
      ) : showFeedback ? (
        <ScrollView contentContainerStyle={styles.feedback} showsVerticalScrollIndicator={false}>
          <VerdictBanner grade={grade!} xp={phraseXp[phraseKey]} />
          {stuck ? (
            <StuckHelp
              onFirstNote={showFirstNote}
              onShowAnswer={showAnswer}
              onEasier={loop.level.rank > MIN_RANK ? loop.easier : undefined}
            />
          ) : null}
          <NoteResultChips results={grade!.noteResults} />
          <Fretboard
            taps={loop.answer}
            statuses={tapStatuses(grade!.noteResults)}
            rowHeight={RESULT_FRET_HEIGHT}
          />
        </ScrollView>
      ) : answering ? (
        <FretboardAnswer
          noteCount={noteCount}
          taps={loop.answer}
          onTap={tapFret}
          replaying={loop.replaying}
          hint={loop.hint}
          draft={draft.on}
          onToggleDraft={switchDraft}
          flash={flash}
          onHearWhole={loop.phraseIndex === 0 && loop.phrases > 1 ? hearWhole : undefined}
        />
      ) : (
        <PracticeStage phase={loop.phase} />
      )}

      <SpeedSlider speed={speed} onChange={changeSpeed} />

      {/* Fixed height whatever the controls (the feedback row is lower than the others), so the slider
          stays put between phases. */}
      <View style={styles.controls}>
        {answering ? (
          <FretboardControls
            placed={loop.answer.length}
            replaying={loop.replaying}
            onReplay={replay}
            onStopReplay={loop.stopReplay}
            onUndo={loop.undoFret}
            onClear={loop.clearFrets}
            onCheck={loop.submitAnswer}
          />
        ) : loop.phase === 'idle' && !startFailed ? null : (
          <TransportControls
            phase={loop.phase}
            replaying={loop.replaying}
            lastPhrase={loop.phraseIndex + 1 >= loop.phrases}
            onPlay={loop.next}
            onReplay={replay}
            onStopReplay={loop.stopReplay}
            onRetry={loop.retry}
            onNextPhrase={loop.nextPhrase}
            onNext={loop.next}
          />
        )}
      </View>
      <RankUpModal rank={rankUpName} onClose={() => setRankUpName(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  feedback: { gap: 18, paddingVertical: 8 },
  controls: { minHeight: 52, justifyContent: 'flex-end' },
});
