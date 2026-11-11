// One daily challenge: its title, a short description, progress and reward. A finished challenge is
// marked by a check and the word "Completed", not by colour alone.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChallengeState } from '../../lib/gamification';
import { Card } from '../common/Card';
import { colors, font, textAlpha } from '../../theme/nocturne';

export function ChallengeCard({ challenge }: { challenge: ChallengeState }) {
  const { title, description, progress, target, rewardXp, completed } = challenge;
  const status = completed ? 'Completed' : `${progress}/${target}`;
  return (
    <Card
      style={[styles.card, completed ? styles.done : {}]}
      accessible
      accessibilityLabel={`${title}. ${completed ? 'Completed' : `${progress} of ${target}`}. ${rewardXp} XP`}
    >
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.reward, completed && styles.rewardDone]}>+{rewardXp} XP</Text>
      </View>
      <Text style={styles.description}>{description}</Text>
      <View style={styles.bar}>
        <View style={[styles.fill, { width: `${Math.round((progress / target) * 100)}%` }]} />
      </View>
      <Text style={[styles.status, completed && styles.statusDone]}>
        {completed ? '✓ ' : ''}
        {status}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 8, borderWidth: 1, borderColor: 'transparent' },
  done: { borderColor: colors.accentRamp[700] },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  title: { color: colors.text, fontSize: 16, fontWeight: font.weightHeading, flexShrink: 1 },
  reward: { color: colors.accentRamp[300], fontSize: 14, fontWeight: font.weightHeading },
  rewardDone: { color: colors.accent },
  description: { color: textAlpha[55], fontSize: 12 },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.divider, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  status: { color: textAlpha[60], fontSize: 12 },
  statusDone: { color: colors.accentRamp[300] },
});
