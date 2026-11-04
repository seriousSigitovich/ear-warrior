// Transport controls (T032, FR-003/FR-007/FR-008/FR-009): the bottom action bar for the phases
// that are not the fretboard answer — Play melody on idle, Replay · Retry · Next on feedback.
// Replay sounds over the result and turns into Stop while it plays.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LoopPhase } from '../../features/practice/usePracticeLoop';
import { Button } from '../common/Button';

export interface TransportControlsProps {
  phase: LoopPhase;
  replaying: boolean;
  onPlay: () => void;
  onReplay: () => void;
  onStopReplay: () => void;
  onRetry: () => void;
  onNext: () => void;
}

export function TransportControls({
  phase,
  replaying,
  onPlay,
  onReplay,
  onStopReplay,
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

  if (phase === 'feedback') {
    return (
      <View style={styles.row}>
        <Button
          label={replaying ? 'Stop' : 'Replay'}
          variant="secondary"
          onPress={replaying ? onStopReplay : onReplay}
          style={styles.grow}
        />
        <Button label="Retry" variant="secondary" onPress={onRetry} style={styles.grow} />
        <Button label="Next" onPress={onNext} style={styles.grow} />
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
