// Center "stage" for the practice loop — the per-phase visual that sits between the header
// and the transport actions. Renders the idle waveform, the animated listening bars, the
// "your turn" fretboard motif, and the live capture indicator. Purely presentational.
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LoopPhase } from '../../features/practice/usePracticeLoop';
import {
  Waveform,
  IDLE_BARS,
  LISTENING_BARS,
} from '../common/Waveform';
import { colors, font, textAlpha } from '../../theme/nocturne';

export function PracticeStage({ phase }: { phase: LoopPhase }) {
  switch (phase) {
    case 'playingMelody':
      return <Listening />;
    case 'awaitingInput':
      return <YourTurn capturing={false} />;
    case 'capturing':
      return <YourTurn capturing />;
    case 'grading':
      return <Grading />;
    case 'idle':
    default:
      return <Idle />;
  }
}

function Idle() {
  return (
    <View style={styles.center}>
      <Waveform bars={IDLE_BARS} height={34} barWidth={4} align="center" />
      <Text style={styles.hint}>Press play, listen, then reproduce the melody.</Text>
    </View>
  );
}

function Listening() {
  return (
    <View style={styles.center}>
      <Waveform bars={LISTENING_BARS} height={52} align="center" animated />
      <Text style={styles.listening}>Listening…</Text>
      <View style={styles.dots}>
        <Dot filled />
        <Dot filled />
        <Dot />
        <Dot />
      </View>
      <Text style={styles.footNote}>Playing target melody</Text>
    </View>
  );
}

function YourTurn({ capturing }: { capturing: boolean }) {
  return (
    <View style={styles.center}>
      <Text style={styles.yourTurn}>Your turn</Text>
      <Text style={styles.sub}>Play it back on your guitar</Text>
      <Fretboard />
      {capturing ? (
        <>
          <ProgressBar />
          <Text style={styles.captureNote}>listening for your notes…</Text>
        </>
      ) : null}
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

// Four "strings" with two note marks — the fretboard motif from the redesign.
function Fretboard() {
  return (
    <View style={styles.fret}>
      <View style={styles.string} />
      <View style={styles.string} />
      <View style={styles.string} />
      <View style={styles.string} />
      <View style={[styles.fretDot, { left: '36%', top: 1 }]} />
      <View style={[styles.fretDot, { left: '64%', top: 24 }]} />
    </View>
  );
}

function Dot({ filled }: { filled?: boolean }) {
  return (
    <View
      style={[
        styles.dot,
        filled ? { backgroundColor: colors.accent } : { borderWidth: 1.5, borderColor: colors.divider },
      ]}
    />
  );
}

// A looping fill that reads as "actively listening" during capture.
function ProgressBar() {
  const w = useRef(new Animated.Value(0.08)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(w, { toValue: 0.9, duration: 2600, useNativeDriver: false }),
        Animated.timing(w, { toValue: 0.08, duration: 400, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [w]);
  const width = w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { width }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  hint: { color: textAlpha[70], fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 230 },
  listening: { color: textAlpha[60], fontSize: 13, letterSpacing: 0.4 },
  footNote: { color: textAlpha[45], fontSize: 13 },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },

  yourTurn: { color: colors.accent, fontSize: 24, fontWeight: font.weightHeading },
  sub: { color: textAlpha[65], fontSize: 14, marginTop: -12 },
  captureNote: { color: textAlpha[45], fontSize: 11 },

  fret: { height: 44, width: 220, justifyContent: 'space-between', paddingVertical: 1 },
  string: { height: 1, backgroundColor: colors.divider },
  fretDot: { position: 'absolute', width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.accent },

  track: {
    width: 220,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.neutral[800],
    overflow: 'hidden',
  },
  fill: { height: 3, backgroundColor: colors.accent },
});
