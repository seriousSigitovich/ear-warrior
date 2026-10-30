// Practice screen (T034): wires the practice loop to transport controls and feedback (US1).
// Redesigned onto Nocturne: a Practice/Level header, a per-phase stage, and feedback rendered
// as a verdict card + note chips (with a non-blocking tuning advisory) or a calm retry state.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, ScrollView, StyleSheet, View } from 'react-native';
import { GradingConfig, Session } from '../src/models';
import { curatedMelody, historyFromAttempts } from '../src/services/melody/curated';
import { MAX_RANK } from '../src/services/melody/levels';
import { tapStatuses } from '../src/lib/fretboard';
import { createAudioPlayback } from '../src/services/audio/playback';
import { createAudioSession } from '../src/services/audio/session';
import { KEY_VALUE_TABLE, defaultRowStore } from '../src/services/storage/db';
import {
  createAttemptRepository,
  createDifficultySettingsRepository,
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
import { withBackend } from '../src/services/progress/difficultyRepo';
import { getAuthService } from '../src/features/auth/authService';
import { getOrCreateDeviceId, keyValueOverRowStore } from '../src/lib/deviceId';
import { track } from '../src/features/analytics/tracker';
import { PracticeLoopDeps, usePracticeLoop } from '../src/features/practice/usePracticeLoop';
import { persistGradedAttempt } from '../src/features/practice/persist';
import { useSession } from '../src/features/practice/session';
import { Screen } from '../src/components/common/Screen';
import { Kicker } from '../src/components/common/Kicker';
import { Tag } from '../src/components/common/Tag';
import { TransportControls } from '../src/components/controls/TransportControls';
import { FretboardControls } from '../src/components/controls/FretboardControls';
import { PracticeStage } from '../src/components/practice/PracticeStage';
import { FretboardAnswer } from '../src/components/practice/FretboardAnswer';
import { Fretboard } from '../src/components/fretboard/Fretboard';
import { VerdictBanner } from '../src/components/feedback/VerdictBanner';
import { NoteResultChips } from '../src/components/feedback/NoteResultChips';
import { RankChangeBanner } from '../src/components/feedback/RankChangeBanner';

// Calibratable default (research.md).
const GRADING_CFG: GradingConfig = {
  centsTolerance: 50,
  octaveSensitive: true,
  lowConfidenceThreshold: 0.6,
};
const APP_VERSION = '0.1.0';

/** Every pitch the fretboard can sound (E2–E5), rendered ahead of time so a tap plays at once. */
const FRETBOARD_MIDI = Array.from({ length: 37 }, (_, i) => 40 + i);

/** Fret height on the result view, where the board sits in a scrolling column. */
const RESULT_FRET_HEIGHT = 26;

// Backend base URL (Node/Postgres). Absent in a build without it → telemetry and progress are no-ops
// and the app stays fully offline.
const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function Practice() {
  // One durable store shared by every repository, and one session per visit to this screen.
  const store = useMemo(() => defaultRowStore(), []);
  const repos = useMemo(
    () => ({
      sessions: createSessionRepository(store),
      attempts: createAttemptRepository(store),
      melodies: createMelodyRepository(store),
      difficulty: createDifficultySettingsRepository(store),
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
  const difficulty = useMemo(
    () => (progress ? withBackend(repos.difficulty, progress) : repos.difficulty),
    [progress, repos.difficulty],
  );
  const [deviceId, setDeviceId] = useState<string | null>(null);

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

  // Tap-to-hear must not stutter: materialize the tones once the screen has settled.
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void playback.preload(FRETBOARD_MIDI).catch(() => undefined);
    });
    return () => task.cancel();
  }, [playback]);

  const deps = useMemo<PracticeLoopDeps>(
    () => ({
      nextMelody: (level, seed, mastered, recent) =>
        curatedMelody(level, seed, undefined, mastered, recent),
      loadHistory,
      playback,
      session: createAudioSession(),
      gradingCfg: GRADING_CFG,
      seed: () => Math.floor(Math.random() * 1e9),
      difficulty,
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
      },
    }),
    [playback, repos, difficulty, loadHistory, progress, sessionId, outbox, deviceId, session],
  );

  const loop = usePracticeLoop(deps);

  const grade = loop.grade;
  const showFeedback = loop.phase === 'feedback' && !!grade;
  const answering = loop.phase === 'awaitingInput';
  const noteCount = loop.melody?.notes.length ?? loop.level.noteCount;

  return (
    <Screen edges={['bottom']}>
      {answering ? null : (
        <View style={styles.header}>
          <Kicker>Practice</Kicker>
          <Tag label={`Level ${loop.level.rank} of ${MAX_RANK}`} />
        </View>
      )}

      {showFeedback ? (
        <ScrollView contentContainerStyle={styles.feedback} showsVerticalScrollIndicator={false}>
          <VerdictBanner grade={grade!} />
          {loop.rankChange ? <RankChangeBanner change={loop.rankChange} /> : null}
          <NoteResultChips results={grade!.noteResults} />
          <Fretboard
            taps={loop.answer}
            statuses={tapStatuses(grade!.noteResults)}
            rowHeight={RESULT_FRET_HEIGHT}
          />
        </ScrollView>
      ) : answering ? (
        <FretboardAnswer noteCount={noteCount} taps={loop.answer} onTap={loop.tapFret} />
      ) : (
        <PracticeStage phase={loop.phase} />
      )}

      {answering ? (
        <FretboardControls
          placed={loop.answer.length}
          onReplay={loop.replay}
          onUndo={loop.undoFret}
          onClear={loop.clearFrets}
          onCheck={loop.submitAnswer}
        />
      ) : (
        <TransportControls
          phase={loop.phase}
          onPlay={loop.next}
          onReplay={loop.replay}
          onRetry={loop.retry}
          onNext={loop.next}
        />
      )}
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
});
