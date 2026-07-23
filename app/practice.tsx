// Practice screen (T034): wires the practice loop to transport controls and feedback (US1).
// Redesigned onto Nocturne: a Practice/Level header, a per-phase stage, and feedback rendered
// as a verdict card + note chips (with a non-blocking tuning advisory) or a calm retry state.
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { GradingConfig, SegmentConfig } from '../src/models';
import { L1 } from '../src/services/melody/levels';
import { STANDARD_TUNING_MIDI } from '../src/features/practice/tuning';
import { createAudioPlayback } from '../src/services/audio/playback';
import { createPitchDetector, PitchDetectionConfig } from '../src/services/audio/pitch';
import { createAudioSession } from '../src/services/audio/session';
import { CaptureConfig } from '../src/features/practice/capture';
import { usePracticeLoop } from '../src/features/practice/usePracticeLoop';
import { Screen } from '../src/components/common/Screen';
import { Kicker } from '../src/components/common/Kicker';
import { Tag } from '../src/components/common/Tag';
import { TransportControls } from '../src/components/controls/TransportControls';
import { PracticeStage } from '../src/components/practice/PracticeStage';
import { VerdictBanner } from '../src/components/feedback/VerdictBanner';
import { NoteResultChips } from '../src/components/feedback/NoteResultChips';
import { TuningAdvisory } from '../src/components/feedback/TuningAdvisory';
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
const GRADING_CFG: GradingConfig = { centsTolerance: 50, octaveSensitive: true, lowConfidenceThreshold: 0.6 };
const CAPTURE_CFG: CaptureConfig = { noInputTimeoutMs: 8000, endSilenceMs: 2000 };

export default function Practice() {
  const deps = useMemo(
    () => ({
      playback: createAudioPlayback(),
      detector: createPitchDetector(),
      session: createAudioSession(),
      pitchCfg: PITCH_CFG,
      segmentCfg: SEGMENT_CFG,
      gradingCfg: GRADING_CFG,
      captureCfg: CAPTURE_CFG,
      seed: () => Math.floor(Math.random() * 1e9),
    }),
    [],
  );

  const loop = usePracticeLoop(L1, deps);

  const grade = loop.grade;
  const showFeedback = loop.phase === 'feedback' && !!grade;
  const retryOnly = !!grade && (grade.timedOut || grade.lowConfidence);
  const showAdvisory = !!loop.tuning?.outOfTune && !retryOnly;

  return (
    <Screen>
      <View style={styles.header}>
        <Kicker>Practice</Kicker>
        <Tag label={`Level ${L1.rank}`} />
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
            <NoteResultChips results={grade!.noteResults} />
          </ScrollView>
        )
      ) : (
        <PracticeStage phase={loop.phase} />
      )}

      <TransportControls
        phase={loop.phase}
        retryOnly={retryOnly}
        onPlay={loop.next}
        onBeginAttempt={loop.beginAttempt}
        onReplay={loop.replay}
        onRetry={loop.retry}
        onNext={loop.next}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  feedback: { gap: 18, paddingVertical: 8 },
});
