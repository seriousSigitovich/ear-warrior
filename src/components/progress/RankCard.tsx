// The learner's rank (spec 013): its name, total XP and a bar towards the next rank. A rank needs XP
// and mastered levels both, so under the bar it says what is still missing — XP, a level, or both; the
// words carry it, the bar is only a picture of the XP.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RankProgress } from '../../lib/gamification';
import { masteryRequirement } from '../../lib/levelLabels';
import { RankIcon } from '../gamification/RankIcon';
import { colors, font, radius, textAlpha, withAlpha } from '../../theme/nocturne';

/** What the next rank still needs, in words. */
export function nextRankLine(rank: RankProgress): string {
  if (!rank.next) return 'The top rank';
  const needs: string[] = [];
  if (rank.missing.xp > 0) needs.push(`${rank.missing.xp} XP`);
  if (rank.missing.levels.length > 0)
    needs.push(`master ${masteryRequirement(rank.missing.levels)}`);
  const first = needs[0];
  return needs.length === 0
    ? `Ready for ${rank.next.name}`
    : `${first.charAt(0).toUpperCase()}${first.slice(1)}${needs[1] ? ` · ${needs[1]}` : ''} for ${rank.next.name}`;
}

export function RankCard({ rank, onPress }: { rank: RankProgress; onPress?: () => void }) {
  const line = nextRankLine(rank);
  const body = (
    <>
      <View style={styles.head}>
        <RankIcon rankId={rank.id} size={56} />
        <View style={styles.title}>
          <Text style={styles.kicker}>Rank</Text>
          <Text style={styles.name}>{rank.name}</Text>
        </View>
        <Text style={styles.xp}>{rank.xp} XP</Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.fill, { width: `${rank.pct}%` }]} />
      </View>
      <Text style={[styles.next, rank.locked && styles.locked]}>{line}</Text>
    </>
  );
  const label = `${rank.name}, ${rank.xp} XP. ${line}`;
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
  locked: { color: colors.accentRamp[300] },
});
