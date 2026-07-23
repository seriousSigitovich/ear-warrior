// Center "stage" for the practice loop — the per-phase visual that sits between the header
// and the transport actions. Renders the idle waveform, the animated listening bars, and the
// "your turn" note ladder that fills in live as the attempt is heard. Purely presentational.
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { CaptureProgress, LoopPhase } from '../../features/practice/usePracticeLoop';
import { noteName } from '../../lib/pitchNote';
import {
  Waveform,
  IDLE_BARS,
  LISTENING_BARS,
} from '../common/Waveform';
import { colors, font, textAlpha, withAlpha } from '../../theme/nocturne';

export interface PracticeStageProps {
  phase: LoopPhase;
  /** Notes in the target melody — the number of marks on the "your turn" ladder. */
  noteCount: number;
  /** Live capture read-out; ignored outside the capturing phase. */
  progress: CaptureProgress;
}

export function PracticeStage({ phase, noteCount, progress }: PracticeStageProps) {
  switch (phase) {
    case 'playingMelody':
      return <Listening />;
    case 'awaitingInput':
      return <YourTurn capturing={false} noteCount={noteCount} progress={progress} />;
    case 'capturing':
      return <YourTurn capturing noteCount={noteCount} progress={progress} />;
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

function YourTurn({
  capturing,
  noteCount,
  progress,
}: {
  capturing: boolean;
  noteCount: number;
  progress: CaptureProgress;
}) {
  const heard = capturing ? Math.min(progress.notesHeard, noteCount) : 0;
  // The most recent onset is the note being played, so it reads as "in progress"; the ones
  // before it are settled. Before anything is heard, the first mark waits for the learner.
  const settled = Math.max(0, heard - 1);
  const current = capturing ? settled : -1;

  return (
    <View style={styles.center}>
      <Text style={styles.yourTurn}>Your turn</Text>
      <Text style={styles.sub}>Play it back on your guitar</Text>

      <View style={styles.ladder}>
        {Array.from({ length: noteCount }, (_, i) => (
          <NoteMark key={i} state={i < settled ? 'settled' : i === current ? 'current' : 'pending'} />
        ))}
      </View>

      <Text style={styles.captureNote}>
        {capturing
          ? `note ${Math.min(Math.max(heard, 1), noteCount)} of ${noteCount}${
              progress.lastMidi === null ? '' : ` — ${noteName(progress.lastMidi)} heard`
            }`
          : `${noteCount} notes to play back`}
      </Text>

      <ProgressBar fraction={capturing ? heard / noteCount : 0} />
    </View>
  );
}

// One note mark on the ladder: settled (accent fill + check), current (pulsing dot), or pending.
function NoteMark({ state }: { state: 'settled' | 'current' | 'pending' }) {
  if (state === 'settled') {
    return (
      <View style={[styles.mark, styles.markSettled]}>
        <Text style={styles.check}>✓</Text>
      </View>
    );
  }
  if (state === 'current') {
    return (
      <View style={[styles.mark, styles.markCurrent]}>
        <PulseDot />
      </View>
    );
  }
  return <View style={[styles.mark, styles.markPending]} />;
}

// The web frame pulses the ring's box-shadow; RN can't animate shadows cheaply, so the inner
// dot carries the pulse instead — same 1.4s beat, same "actively hearing this note" read.
function PulseDot() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.pulseDot,
        {
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
        },
      ]}
    />
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

// Attempt progress: how much of the melody has been played back, eased in as notes land
// (the web frame's `transition: width .5s ease`).
function ProgressBar({ fraction }: { fraction: number }) {
  const w = useRef(new Animated.Value(fraction)).current;
  useEffect(() => {
    const anim = Animated.timing(w, {
      toValue: Math.max(0, Math.min(1, fraction)),
      duration: 500,
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [w, fraction]);
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

  yourTurn: { color: colors.accent, fontSize: 22, fontWeight: font.weightHeading },
  sub: { color: textAlpha[65], fontSize: 13, marginTop: -14 },
  captureNote: { color: textAlpha[55], fontSize: 11, letterSpacing: 0.2, marginTop: -12 },

  ladder: { flexDirection: 'row', gap: 8, marginTop: 6 },
  mark: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  markSettled: {
    backgroundColor: withAlpha(colors.accent, 0.22),
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  markCurrent: { borderWidth: 1.5, borderColor: colors.accent },
  markPending: { borderWidth: 1.5, borderColor: colors.divider },
  check: { color: colors.accentRamp[300], fontSize: 14, fontWeight: '700', lineHeight: 17 },
  pulseDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.accent },

  track: {
    width: 240,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.neutral[800],
    overflow: 'hidden',
  },
  fill: { height: 3, backgroundColor: colors.accent },
});
