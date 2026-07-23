// Rank-change notice (T061, US2). Difficulty must never shift silently — when adaptation moves the
// learner up or down, the feedback step says so (Constitution III: predictable behavior). Carries an
// accessible label so screen readers announce the change too (SC-009).
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RankChange } from '../../features/practice/usePracticeLoop';
import { getLevelByRank } from '../../services/melody/levels';
import { Card } from '../common/Card';
import { colors, font, textAlpha, withAlpha } from '../../theme/nocturne';

export function RankChangeBanner({ change }: { change: RankChange }) {
  const up = change.direction === 'up';
  const hue = up ? colors.accent : colors.warm;
  const noteCount = getLevelByRank(change.to).noteCount;
  const title = up ? 'Level up' : 'Easing off';
  const detail = `Level ${change.to} — ${noteCount} notes`;

  return (
    <Card
      style={styles.card}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${title}. Now level ${change.to} of 7, ${noteCount} notes per melody.`}
    >
      <View style={[styles.badge, { backgroundColor: withAlpha(hue, 0.16) }]}>
        <Text style={[styles.glyph, { color: up ? colors.accentRamp[300] : colors.warm }]}>
          {up ? '↑' : '↓'}
        </Text>
      </View>
      <View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{detail}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 15, fontWeight: '700', lineHeight: 19 },
  title: { color: colors.text, fontSize: 14, fontWeight: font.weightHeading },
  subtitle: { color: textAlpha[55], fontSize: 12, marginTop: 2 },
});
