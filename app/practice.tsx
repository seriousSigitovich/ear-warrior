// Practice screen (T034): wires the practice loop to transport controls and feedback (US1).
// Redesigned onto Nocturne: a Practice/Level header, a per-phase stage, and feedback rendered
// as a verdict card + note chips (with a non-blocking tuning advisory) or a calm retry state.
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { GradingConfig, SegmentConfig, Session } from '../src/models';
import { MAX_RANK } from '../src/services/melody/levels';
import { STANDARD_TUNING_MIDI } from '../src/features/practice/tuning';
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
import { getOrCreateDeviceId, keyValueOverRowStore } from '../src/lib/deviceId';
import { CaptureConfig } from '../src/features/practice/capture';
import { PracticeLoopDeps, usePracticeLoop } from '../src/features/practice/usePracticeLoop';
import { persistGradedAttempt } from '../src/features/practice/persist';
import { useSession } from '../src/features/practice/session';
import { Screen } from '../src/components/common/Screen';
import { Kicker } from '../src/components/common/Kicker';
import { Tag } from '../src/components/common/Tag';
import { TransportControls } from '../src/components/controls/TransportControls';
import { PracticeStage } from '../src/components/practice/PracticeStage';
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
};
const GRADING_CFG: GradingConfig = {
  centsTolerance: 50,
  octaveSensitive: true,
  lowConfidenceThreshold: 0.6,
};
const CAPTURE_CFG: CaptureConfig = { noInputTimeoutMs: 8000, endSilenceMs: 2000 };

const APP_VERSION = '0.1.0';

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
    () =>
      createAttemptLogOutbox(
        defaultAttemptLogClient(
          process.env.EXPO_PUBLIC_SUPABASE_URL,
          process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        ) ?? createNullAttemptLogClient(),
      ),
    [],
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

  const session = useSession(sessionId, repos.sessions);
  // `end` is stable enough to run on unmount; ending is idempotent (`ended` is terminal).
  const endSession = session.end;
  useEffect(() => () => endSession(), [endSession]);

  const deps = useMemo<PracticeLoopDeps>(
    () => ({
      playback: createAudioPlayback(),
      detector: createPitchDetector(),
      session: createAudioSession(),
      pitchCfg: PITCH_CFG,
      segmentCfg: SEGMENT_CFG,
      gradingCfg: GRADING_CFG,
      captureCfg: CAPTURE_CFG,
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
    [repos, sessionId, outbox, deviceId, session],
  );

  const loop = usePracticeLoop(deps);

  const grade = loop.grade;
  const showFeedback = loop.phase === 'feedback' && !!grade;
  const retryOnly = !!grade && (grade.timedOut || grade.lowConfidence);
  const showAdvisory = !!loop.tuning?.outOfTune && !retryOnly;

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
          </ScrollView>
        )
      ) : (
        <PracticeStage
          phase={loop.phase}
          noteCount={loop.melody?.notes.length ?? loop.level.noteCount}
          progress={loop.progress}
        />
      )}

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
