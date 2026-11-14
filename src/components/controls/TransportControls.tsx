// Transport controls (T032, FR-003/FR-007/FR-008/FR-009; spec 014): the bottom action bar for the phases that
// are not the fretboard answer — Play melody if the practice could not start by itself; Replay · Retry ·
// Next phrase on a phrase's result; Replay · Next melody once the tune is done. Replay turns into Stop
// while it plays. (The phrase itself plays on the answer screen, whose own controls handle it.)
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LoopPhase } from '../../features/practice/usePracticeLoop';
import { Button } from '../common/Button';

export interface TransportControlsProps {
  phase: LoopPhase;
  replaying: boolean;
  /** A replay was paused part-way: Resume picks it up (spec 021). */
  paused?: boolean;
  /** The phrase on screen is the tune's last. */
  lastPhrase: boolean;
  onPlay: () => void;
  onReplay: () => void;
  onStopReplay: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onRetry: () => void;
  onNextPhrase: () => void;
  onNext: () => void;
}

export function TransportControls({
  phase,
  replaying,
  paused,
  lastPhrase,
  onPlay,
  onReplay,
  onStopReplay,
  onPause,
  onResume,
  onRetry,
  onNextPhrase,
  onNext,
}: TransportControlsProps) {
  // Replay while nothing sounds, Pause while it does, Resume once it is paused (spec 021).
  const replayButton = (
    <Button
      label={replaying ? (onPause ? 'Pause' : 'Stop') : paused && onResume ? 'Resume' : 'Replay'}
      variant="secondary"
      onPress={replaying ? (onPause ?? onStopReplay) : paused && onResume ? onResume : onReplay}
      style={styles.grow}
    />
  );

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
        {replayButton}
        <Button label="Retry" variant="secondary" onPress={onRetry} style={styles.grow} />
        <Button
          label={lastPhrase ? 'Finish' : 'Next phrase'}
          onPress={onNextPhrase}
          style={styles.wide}
        />
      </View>
    );
  }

  if (phase === 'complete') {
    return (
      <View style={styles.row}>
        {replayButton}
        <Button label="Next melody" onPress={onNext} style={styles.wide} />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  row: { flexDirection: 'row', gap: 8 },
  grow: { flex: 1 },
  wide: { flex: 1.6 },
  tall: { minHeight: 52 },
});
