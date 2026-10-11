// Practice screen (T034): wires the practice loop to transport controls and feedback (US1).
// Redesigned onto Nocturne: a Practice/Level header, a per-phase stage, and feedback rendered
// as a verdict card + note chips (with a non-blocking tuning advisory) or a calm retry state.
import React, { useEffect, useMemo, useState } from 'react';
import { InteractionManager, ScrollView, StyleSheet, View } from 'react-native';
import { CalibrationConfig, GradingConfig, InputMode, SegmentConfig, Session } from '../src/models';
import { MAX_RANK } from '../src/services/melody/levels';
import { STANDARD_TUNING_MIDI } from '../src/features/practice/tuning';
import { tapStatuses } from '../src/lib/fretboard';
import { createAudioPlayback } from '../src/services/audio/playback';
import { createPitchDetector, PitchDetectionConfig } from '../src/services/audio/pitch';
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
import { createSyncClient } from '../src/services/sync/client';
import { syncPull, syncPush } from '../src/services/sync/sync';
import { getOrCreateDeviceId, keyValueOverRowStore } from '../src/lib/deviceId';
import { CaptureConfig } from '../src/features/practice/capture';
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
import { TuningAdvisory } from '../src/components/feedback/TuningAdvisory';
import { RankChangeBanner } from '../src/components/feedback/RankChangeBanner';
import { RetryState } from '../src/components/feedback/RetryState';

// Calibratable defaults (research.md — tuned on-device).
const PITCH_CFG: PitchDetectionConfig = { minHz: 80, maxHz: 1320, clarityThreshold: 0.5 };
const SEGMENT_CFG: SegmentConfig = {
  clarityThreshold: 0.5,
  minNoteMs: 60,
  gapMs: 200,
  minHz: 80,
  maxHz: 1320,
  onsetConfirmFrames: 3,
  attackGuardMs: 40,
};
const GRADING_CFG: GradingConfig = {
  centsTolerance: 50,
  octaveSensitive: true,
  lowConfidenceThreshold: 0.6,
};
const CAPTURE_CFG: CaptureConfig = { noInputTimeoutMs: 8000, endSilenceMs: 2000, warmupMs: 120 };
// Tier 1 noise robustness — voicing gate calibrated per capture from ambient clarity (research.md).
const CALIBRATION_CFG: CalibrationConfig = {
  ambientPercentile: 0.2,
  margin: 0.15,
  hardMin: 0.3,
  hardMax: 0.7,
  minFrames: 20,
};

const APP_VERSION = '0.1.0';

// How the learner answers. The MVP answers on an on-screen fretboard (no microphone); the
// microphone pipeline is kept intact and comes back with EXPO_PUBLIC_INPUT_MODE=mic.
const INPUT_MODE: InputMode = process.env.EXPO_PUBLIC_INPUT_MODE === 'mic' ? 'mic' : 'fretboard';

/** Every pitch the fretboard can sound (E2–G5), rendered ahead of time so a tap plays at once. */
const FRETBOARD_MIDI = Array.from({ length: 40 }, (_, i) => 40 + i);

/** Fret height on the result view, where the board sits in a scrolling column. */
const RESULT_FRET_HEIGHT = 26;

// Backend base URL (Node/Postgres). Absent in a build without it → telemetry and sync are no-ops
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
  const syncClient = useMemo(() => createSyncClient(API_URL), []);
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

  // Hydrate the local cache from the backend once we know the device id (fresh install / other
  // device). Best-effort and non-blocking; the app is fully usable offline meanwhile.
  useEffect(() => {
    if (!deviceId || !syncClient) return;
    void syncPull(store, syncClient, deviceId);
  }, [deviceId, syncClient, store]);

  const session = useSession(sessionId, repos.sessions);
  // `end` is stable enough to run on unmount; ending is idempotent (`ended` is terminal).
  const endSession = session.end;
  useEffect(() => () => endSession(), [endSession]);

  // On leaving the screen, push this session's records up to the durable backend. Best-effort.
  useEffect(() => {
    return () => {
      if (syncClient && deviceId) void syncPush(store, syncClient, deviceId);
    };
  }, [syncClient, deviceId, store]);

  const playback = useMemo(() => createAudioPlayback(), []);

  // Tap-to-hear must not stutter: materialize the tones once the screen has settled.
  useEffect(() => {
    if (INPUT_MODE !== 'fretboard') return;
    const task = InteractionManager.runAfterInteractions(() => {
      void playback.preload(FRETBOARD_MIDI).catch(() => undefined);
    });
    return () => task.cancel();
  }, [playback]);

  const deps = useMemo<PracticeLoopDeps>(
    () => ({
      inputMode: INPUT_MODE,
      playback,
      detector: createPitchDetector(),
      session: createAudioSession(),
      pitchCfg: PITCH_CFG,
      segmentCfg: SEGMENT_CFG,
      gradingCfg: GRADING_CFG,
      captureCfg: CAPTURE_CFG,
      calibrationCfg: CALIBRATION_CFG,
      seed: () => Math.floor(Math.random() * 1e9),
      difficulty: repos.difficulty,
      sessionId,
      onAttemptGraded: (attempt, melody, level) => {
        // Every attempt is recorded (FR-012); only graded ones move the session tally.
        void persistGradedAttempt(attempt, melody, level, {
          attempts: repos.attempts,
          melodies: repos.melodies,
          outbox,
          appVersion: APP_VERSION,
          deviceId: deviceId ?? 'dev_pending',
        });
        if (!attempt.timedOut && !attempt.lowConfidence) {
          session.recordAttempt(attempt.verdict === 'correct');
        }
      },
    }),
    [playback, repos, sessionId, outbox, deviceId, session],
  );

  const loop = usePracticeLoop(deps);

  const grade = loop.grade;
  const showFeedback = loop.phase === 'feedback' && !!grade;
  const retryOnly = !!grade && (grade.timedOut || grade.lowConfidence);
  const showAdvisory = !!loop.tuning?.outOfTune && !retryOnly;
  const fretMode = loop.inputMode === 'fretboard';
  const answering = fretMode && loop.phase === 'awaitingInput';
  const noteCount = loop.melody?.notes.length ?? loop.level.noteCount;

  return (
    <Screen>
      <View style={styles.header}>
        <Kicker>Practice</Kicker>
        <Tag label={`Level ${loop.level.rank} of ${MAX_RANK}`} />
      </View>

      {showFeedback ? (
        retryOnly ? (
          <RetryState timedOut={grade!.timedOut} />
        ) : (
          <ScrollView contentContainerStyle={styles.feedback} showsVerticalScrollIndicator={false}>
            {showAdvisory ? (
              <TuningAdvisory
                direction={loop.tuning!.direction}
                onTune={() => loop.tuning!.playReference(STANDARD_TUNING_MIDI[0])}
              />
            ) : null}
            <VerdictBanner grade={grade!} />
            {loop.rankChange ? <RankChangeBanner change={loop.rankChange} /> : null}
            <NoteResultChips results={grade!.noteResults} />
            {fretMode ? (
              <Fretboard
                taps={loop.answer}
                statuses={tapStatuses(grade!.noteResults)}
                rowHeight={RESULT_FRET_HEIGHT}
              />
            ) : null}
          </ScrollView>
        )
      ) : answering ? (
        <FretboardAnswer noteCount={noteCount} taps={loop.answer} onTap={loop.tapFret} />
      ) : (
        <PracticeStage
          phase={loop.phase}
          noteCount={noteCount}
          progress={loop.progress}
          inputMode={loop.inputMode}
        />
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
          retryOnly={retryOnly}
          onPlay={loop.next}
          onBeginAttempt={loop.beginAttempt}
          onReplay={loop.replay}
          onRetry={loop.retry}
          onNext={loop.next}
          onStop={loop.stopAttempt}
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
