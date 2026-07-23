// Practice screen (T034): wires the practice loop to transport controls and feedback (US1).
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { GradingConfig, SegmentConfig } from '../src/models';
import { L1 } from '../src/services/melody/levels';
import { createAudioPlayback } from '../src/services/audio/playback';
import { createPitchDetector, PitchDetectionConfig } from '../src/services/audio/pitch';
import { createAudioSession } from '../src/services/audio/session';
import { CaptureConfig } from '../src/features/practice/capture';
import { usePracticeLoop } from '../src/features/practice/usePracticeLoop';
import { Screen } from '../src/components/common/Screen';
import { TransportControls } from '../src/components/controls/TransportControls';
import { VerdictBanner } from '../src/components/feedback/VerdictBanner';
import { NoteResultChips } from '../src/components/feedback/NoteResultChips';

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

  return (
    <Screen title="Practice">
      <ScrollView contentContainerStyle={styles.content}>
        {loop.tuning?.outOfTune ? (
          <Text style={styles.tuning}>
            ⚠️ Guitar sounds {loop.tuning.direction}. Tap Replay to hear a reference — or keep going.
          </Text>
        ) : null}

        {loop.grade ? (
          <View style={styles.feedback}>
            <VerdictBanner grade={loop.grade} />
            <NoteResultChips results={loop.grade.noteResults} />
          </View>
        ) : (
          <Text style={styles.hint}>Press play, listen, then reproduce the melody.</Text>
        )}
      </ScrollView>

      <TransportControls
        phase={loop.phase}
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
  content: { flexGrow: 1, justifyContent: 'center', gap: 16 },
  feedback: { gap: 16 },
  hint: { color: '#C1C2C5', fontSize: 16, textAlign: 'center' },
  tuning: { color: '#FFD43B', fontSize: 15, textAlign: 'center' },
});
