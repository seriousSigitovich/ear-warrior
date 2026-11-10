// Center "stage" for the practice loop — the per-phase visual that sits between the header
// and the transport actions. Renders the idle waveform and the animated listening bars while the
// melody plays; the fretboard answer view is its own component. Purely presentational.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LoopPhase } from '../../features/practice/usePracticeLoop';
import { Waveform, IDLE_BARS, LISTENING_BARS } from '../common/Waveform';
import { textAlpha } from '../../theme/nocturne';

export interface PracticeStageProps {
  phase: LoopPhase;
  /** The melody being listened to is held. */
  paused?: boolean;
  /** Replaces the idle hint: what the melody about to play is (a tune picked from the library). */
  idleHint?: string;
}

export function PracticeStage({ phase, paused = false, idleHint }: PracticeStageProps) {
  switch (phase) {
    case 'playingMelody':
      return <Listening paused={paused} />;
    case 'grading':
      return <Grading />;
    case 'idle':
    case 'awaitingInput':
    case 'feedback':
    default:
      return <Idle hint={idleHint} />;
  }
}

function Idle({ hint }: { hint?: string }) {
  return (
    <View style={styles.center}>
      <Waveform bars={IDLE_BARS} height={34} barWidth={4} align="center" />
      <Text style={styles.hint}>
        {hint ?? 'Press play, listen, then find the notes on the fretboard.'}
      </Text>
    </View>
  );
}

function Listening({ paused }: { paused: boolean }) {
  return (
    <View style={styles.center}>
      <Waveform bars={LISTENING_BARS} height={52} align="center" animated={!paused} />
      <Text style={styles.listening} accessibilityLiveRegion="polite">
        {paused ? 'Paused' : 'Listening…'}
      </Text>
    </View>
  );
}

function Grading() {
  return (
    <View style={styles.center}>
      <Waveform bars={LISTENING_BARS} height={40} align="center" animated />
      <Text style={styles.listening}>Checking your notes…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  hint: { color: textAlpha[70], fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 230 },
  listening: { color: textAlpha[60], fontSize: 13, letterSpacing: 0.4 },
});
