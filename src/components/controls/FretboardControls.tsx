// Action bar while answering on the fretboard: Replay · Undo · Clear · Check. Replay stays live
// (hearing the melody again is the whole exercise) and turns into Stop while the melody sounds;
// Check needs at least one note placed.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../common/Button';
import { IconButton, ReplayIcon, StopIcon } from '../common/IconButton';
import { colors } from '../../theme/nocturne';

export interface FretboardControlsProps {
  placed: number;
  /** The melody is being replayed over the board. */
  replaying: boolean;
  onReplay: () => void;
  onStopReplay: () => void;
  onUndo: () => void;
  onClear: () => void;
  onCheck: () => void;
}

export function FretboardControls({
  placed,
  replaying,
  onReplay,
  onStopReplay,
  onUndo,
  onClear,
  onCheck,
}: FretboardControlsProps) {
  const empty = placed === 0;
  return (
    <View style={styles.row}>
      {replaying ? (
        <IconButton accessibilityLabel="Stop melody" onPress={onStopReplay} active>
          <StopIcon color={colors.accent} />
        </IconButton>
      ) : (
        <IconButton accessibilityLabel="Replay melody" onPress={onReplay}>
          <ReplayIcon />
        </IconButton>
      )}
      <IconButton accessibilityLabel="Undo last note" onPress={onUndo} disabled={empty}>
        <Text style={styles.glyph}>↶</Text>
      </IconButton>
      <IconButton accessibilityLabel="Clear all notes" onPress={onClear} disabled={empty}>
        <Text style={styles.glyph}>✕</Text>
      </IconButton>
      <Button label="Check" onPress={onCheck} disabled={empty} glow style={styles.check} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  check: { flex: 1, minHeight: 52 },
  glyph: { color: colors.text, fontSize: 18, lineHeight: 22 },
});
