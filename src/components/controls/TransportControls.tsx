// Transport controls (T032, FR-003/FR-007/FR-008/FR-009): the bottom action bar for each
// phase — Play melody / (replay · Start playing) / (replay · Stop & check) /
// (Replay · Retry · Next). When the attempt couldn't be graded (timeout / low confidence)
// the feedback bar narrows to Replay · Retry.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LoopPhase } from '../../features/practice/usePracticeLoop';
import { Button } from '../common/Button';
import { IconButton, ReplayIcon } from '../common/IconButton';

export interface TransportControlsProps {
  phase: LoopPhase;
  /** feedback that couldn't be scored — offer only Replay / Retry. */
  retryOnly?: boolean;
  onPlay: () => void;
  onBeginAttempt: () => void;
  onReplay: () => void;
  onRetry: () => void;
  onNext: () => void;
  /** End the capture window early and grade what was heard. */
  onStop: () => void;
}

export function TransportControls({
  phase,
  retryOnly,
  onPlay,
  onBeginAttempt,
  onReplay,
  onRetry,
  onNext,
  onStop,
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
      <View style={styles.row}>
        <IconButton accessibilityLabel="Replay melody" onPress={onReplay}>
          <ReplayIcon />
        </IconButton>
        <Button label="Start playing" onPress={onBeginAttempt} style={[styles.grow, styles.tall]} />
      </View>
    );
  }

  if (phase === 'capturing') {
    return (
      <View style={styles.row}>
        {/* Replaying mid-attempt would bleed the target melody into the mic, so it waits. */}
        <IconButton accessibilityLabel="Replay melody" onPress={onReplay} disabled>
          <ReplayIcon />
        </IconButton>
        <Button label="Stop & check" onPress={onStop} style={[styles.grow, styles.tall]} />
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
