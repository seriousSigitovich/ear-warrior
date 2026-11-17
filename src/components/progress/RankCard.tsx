// The learner's rank (spec 013, 024): its name, total XP and a bar towards the next rank. A rank is reached by XP
// alone, so under the bar it says how much is still missing.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RankView } from '../../services/rewards/types';
import { RankIcon } from '../gamification/RankIcon';
import { colors, font, radius, textAlpha, withAlpha } from '../../theme/nocturne';

/** What the next rank still needs, in words. */
export function nextRankLine(rank: RankView): string {
  return rank.next ? `${rank.xpToNext} XP for ${rank.next.name}` : 'The top rank';
}

export function RankCard({
  rank,
  xp,
  onPress,
}: {
  rank: RankView;
  xp: number;
  onPress?: () => void;
}) {
  const line = nextRankLine(rank);
  const body = (
    <>
      <View style={styles.head}>
        <RankIcon rankId={rank.id} size={56} />
        <View style={styles.title}>
          <Text style={styles.kicker}>Rank</Text>
          <Text style={styles.name}>{rank.name}</Text>
        </View>
        <Text style={styles.xp}>{xp} XP</Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.fill, { width: `${rank.pct}%` }]} />
      </View>
      <Text style={styles.next}>{line}</Text>
    </>
  );
  const label = `${rank.name}, ${xp} XP. ${line}`;
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. Open ranks`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  ) : (
    <View style={styles.card} accessible accessibilityLabel={label}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, gap: 10 },
  pressed: { backgroundColor: withAlpha(colors.accent, 0.14) },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { flex: 1 },
  kicker: { color: colors.accent, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  name: { color: colors.text, fontSize: 22, fontWeight: font.weightHeading, marginTop: 2 },
  xp: { color: colors.accentRamp[300], fontSize: 15, fontWeight: font.weightHeading },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.divider, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  next: { color: textAlpha[55], fontSize: 12 },
});
