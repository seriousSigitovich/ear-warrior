// Home's rank card (spec 023): the rank and where the next one is. "40 / 100 XP" against the next threshold, a
// bar towards it and one line of what is still missing. When XP has just gone up, "+N XP" rises and fades beside it.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { RankProgress } from '../../lib/gamification';
import { rankGoalLine, rankXpLine } from '../../lib/homeCopy';
import { AnimatedBar } from '../common/AnimatedBar';
import { Kicker } from '../common/Kicker';
import { useReduceMotion } from '../common/Waveform';
import { RankIcon } from '../gamification/RankIcon';
import { colors, font, radius, textAlpha, withAlpha } from '../../theme/nocturne';

const GAIN_MS = 1800;

/** "+N XP" for a moment after the XP went up; nothing on the first reading or when it did not rise. */
function XpGain({ xp }: { xp: number }) {
  const still = useReduceMotion();
  const last = useRef<number | null>(null);
  const [gain, setGain] = useState(0);
  const phase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const before = last.current;
    last.current = xp;
    if (before === null || xp <= before) return;
    setGain(xp - before);
    phase.setValue(0);
    const run = Animated.timing(phase, {
      toValue: 1,
      duration: still ? 0 : GAIN_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    run.start(({ finished }) => finished && setGain(0));
    return () => run.stop();
  }, [xp, still, phase]);
  if (gain === 0) return null;
  return (
    <Animated.Text
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        styles.gain,
        {
          opacity: phase.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [4, -8] }) },
          ],
        },
      ]}
    >
      +{gain} XP
    </Animated.Text>
  );
}

export function RankXpCard({ rank, onPress }: { rank: RankProgress; onPress: () => void }) {
  const goal = rankGoalLine(rank);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Your rank: ${rank.name}, ${rankXpLine(rank)}. ${goal}. Open ranks`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Kicker style={styles.kicker}>Your rank</Kicker>
      <View style={styles.head}>
        <RankIcon rankId={rank.id} size={32} />
        <Text style={styles.name}>{rank.name}</Text>
        <View style={styles.xpBox}>
          <XpGain xp={rank.xp} />
          <Text style={styles.xp}>{rankXpLine(rank)}</Text>
        </View>
      </View>
      <AnimatedBar pct={rank.pct} height={5} />
      <Text style={[styles.goal, rank.locked && styles.locked]}>{goal}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, gap: 6 },
  pressed: { backgroundColor: withAlpha(colors.accent, 0.14) },
  kicker: { fontSize: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, color: colors.text, fontSize: 18, fontWeight: font.weightHeading },
  xpBox: { alignItems: 'flex-end' },
  xp: { color: colors.accentRamp[300], fontSize: 13, fontWeight: font.weightHeading },
  gain: { position: 'absolute', top: -14, color: colors.accentRamp[300], fontSize: 12 },
  goal: { color: textAlpha[55], fontSize: 12 },
  locked: { color: colors.accentRamp[300] },
});
