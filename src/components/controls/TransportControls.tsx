// Transport controls (T032, FR-003/FR-007/FR-008/FR-009): the bottom action bar for each
// phase — Play melody / Start playing / (Replay · Retry · Next). When the attempt couldn't be
// graded (timeout / low confidence) the feedback bar narrows to Replay · Retry.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LoopPhase } from '../../features/practice/usePracticeLoop';
import { Button } from '../common/Button';

export interface TransportControlsProps {
  phase: LoopPhase;
  /** feedback that couldn't be scored — offer only Replay / Retry. */
  retryOnly?: boolean;
  onPlay: () => void;
  onBeginAttempt: () => void;
  onReplay: () => void;
  onRetry: () => void;
  onNext: () => void;
}

export function TransportControls({
  phase,
  retryOnly,
  onPlay,
  onBeginAttempt,
  onReplay,
  onRetry,
  onNext,
}: TransportControlsProps) {
  if (phase === 'idle') {
    return (
      <View style={styles.wrap}>
        <Button label="Play melody" onPress={onPlay} style={styles.tall} />
      </View>
    );
  }

  if (phase === 'awaitingInput') {
    return (
      <View style={styles.wrap}>
        <Button label="Start playing" onPress={onBeginAttempt} style={styles.tall} />
      </View>
    );
  }

  if (phase === 'feedback') {
    return (
      <View style={styles.row}>
        <Button label="Replay" variant="secondary" onPress={onReplay} style={styles.grow} />
        {retryOnly ? (
          <Button label="Retry" onPress={onRetry} style={styles.grow} />
        ) : (
          <>
            <Button label="Retry" variant="secondary" onPress={onRetry} style={styles.grow} />
            <Button label="Next" onPress={onNext} style={styles.grow} />
          </>
        )}
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  row: { flexDirection: 'row', gap: 8 },
  grow: { flex: 1 },
  tall: { minHeight: 52 },
});
