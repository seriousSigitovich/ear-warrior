// Transport controls (T032, FR-003/FR-007/FR-008/FR-009): Play / Replay / Retry / Next + "your turn" cue.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LoopPhase } from '../../features/practice/usePracticeLoop';
import { Button } from '../common/Button';

export interface TransportControlsProps {
  phase: LoopPhase;
  onPlay: () => void;
  onBeginAttempt: () => void;
  onReplay: () => void;
  onRetry: () => void;
  onNext: () => void;
}

export function TransportControls({
  phase,
  onPlay,
  onBeginAttempt,
  onReplay,
  onRetry,
  onNext,
}: TransportControlsProps) {
  const yourTurn = phase === 'awaitingInput';
  return (
    <View style={styles.wrap}>
      {yourTurn ? (
        <Text accessibilityLiveRegion="polite" style={styles.cue}>
          🎸 Your turn — play it back
        </Text>
      ) : null}

      {phase === 'idle' ? <Button label="Play melody" onPress={onPlay} /> : null}
      {yourTurn ? <Button label="Start playing" onPress={onBeginAttempt} /> : null}

      {phase === 'feedback' ? (
        <View style={styles.row}>
          <Button label="Replay" variant="secondary" onPress={onReplay} style={styles.grow} />
          <Button label="Retry" variant="secondary" onPress={onRetry} style={styles.grow} />
          <Button label="Next" onPress={onNext} style={styles.grow} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  row: { flexDirection: 'row', gap: 8 },
  grow: { flex: 1 },
  cue: { color: '#8CE99A', fontSize: 18, fontWeight: '600', textAlign: 'center' },
});
