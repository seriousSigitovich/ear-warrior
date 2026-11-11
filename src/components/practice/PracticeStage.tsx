// Center "stage" for the practice loop — the per-phase visual that sits between the header and the
// transport actions, for the moments the fretboard answer is not on screen: the quiet waveform while a
// melody is being served (a beat at the start), and the grading state. The phrase itself plays on the
// fretboard answer screen (spec 014). Purely presentational.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LoopPhase } from '../../features/practice/usePracticeLoop';
import { Waveform, IDLE_BARS, LISTENING_BARS } from '../common/Waveform';
import { textAlpha } from '../../theme/nocturne';

export interface PracticeStageProps {
  phase: LoopPhase;
}

export function PracticeStage({ phase }: PracticeStageProps) {
  if (phase === 'grading') {
    return (
      <View style={styles.center}>
        <Waveform bars={LISTENING_BARS} height={40} align="center" animated />
        <Text style={styles.listening}>Checking your notes…</Text>
      </View>
    );
  }
  return (
    <View style={styles.center}>
      <Waveform bars={IDLE_BARS} height={34} barWidth={4} align="center" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  listening: { color: textAlpha[60], fontSize: 13, letterSpacing: 0.4 },
});
