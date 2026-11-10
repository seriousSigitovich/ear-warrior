// Transport controls (T032, FR-003/FR-007/FR-008/FR-009): the bottom action bar for the phases that
// are not the fretboard answer — Play melody on idle; Pause · Restart · Skip while the tune or a
// phrase plays before the answer; Replay · Retry · Next phrase on a phrase's result; Replay · Next
// melody once the tune is done. Replay turns into Stop while it plays.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Listening, LoopPhase } from '../../features/practice/usePracticeLoop';
import { Button } from '../common/Button';

export interface TransportControlsProps {
  phase: LoopPhase;
  listening: Listening;
  replaying: boolean;
  /** The melody being listened to is held. */
  paused: boolean;
  /** The phrase on screen is the tune's last. */
  lastPhrase: boolean;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onSkip: () => void;
  onReplay: () => void;
  onStopReplay: () => void;
  onRetry: () => void;
  onNextPhrase: () => void;
  onNext: () => void;
}

export function TransportControls({
  phase,
  listening,
  replaying,
  paused,
  lastPhrase,
  onPlay,
  onPause,
  onResume,
  onRestart,
  onSkip,
  onReplay,
  onStopReplay,
  onRetry,
  onNextPhrase,
  onNext,
}: TransportControlsProps) {
  const replayButton = (
    <Button
      label={replaying ? 'Stop' : 'Replay'}
      variant="secondary"
      onPress={replaying ? onStopReplay : onReplay}
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

  if (phase === 'playingMelody') {
    const whole = listening === 'tune';
    return (
      <View style={styles.row} accessibilityLabel={whole ? 'Melody controls' : 'Phrase controls'}>
        <Button
          label={paused ? 'Resume' : 'Pause'}
          variant="secondary"
          onPress={paused ? onResume : onPause}
          style={styles.grow}
        />
        <Button label="Restart" variant="secondary" onPress={onRestart} style={styles.grow} />
        <Button label="Skip" onPress={onSkip} style={styles.grow} />
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
  row: { flexDirection: 'row', gap: 8, minHeight: 52 },
  grow: { flex: 1 },
  wide: { flex: 1.6 },
  tall: { minHeight: 52 },
});
