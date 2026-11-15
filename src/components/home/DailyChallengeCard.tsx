// A daily challenge as a card (spec 023): one of the day's real challenges (title, reward, progress), never a
// made-up one. The caller passes a challenge from the standing (src/lib/gamification `challengeStates`); Home shows
// the card only while the challenges are on (`SHOW_DAILY_CHALLENGES`).
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ChallengeState } from '../../lib/gamification';
import { AnimatedBar } from '../common/AnimatedBar';
import { Button } from '../common/Button';
import { Kicker } from '../common/Kicker';
import { colors, font, radius, textAlpha } from '../../theme/nocturne';

export function DailyChallengeCard({
  challenge,
  onStart,
}: {
  challenge: ChallengeState;
  onStart: () => void;
}) {
  return (
    <View style={styles.card}>
      <Kicker style={styles.kicker}>Daily challenge</Kicker>
      <View style={styles.head}>
        <Text style={styles.title}>{challenge.title}</Text>
        <Text style={styles.reward}>+{challenge.rewardXp} XP</Text>
      </View>
      <Text style={styles.description}>{challenge.description}</Text>
      <View
        style={styles.progress}
        accessible
        accessibilityLabel={`${challenge.progress} of ${challenge.target} done`}
      >
        <AnimatedBar
          pct={(challenge.progress / challenge.target) * 100}
          height={5}
          style={styles.bar}
        />
        <Text style={styles.count}>
          {challenge.progress} / {challenge.target}
        </Text>
      </View>
      <Button label="Start challenge" onPress={onStart} style={styles.cta} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, gap: 8 },
  kicker: { fontSize: 10 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, color: colors.text, fontSize: 17, fontWeight: font.weightHeading },
  reward: { color: colors.accentRamp[300], fontSize: 13, fontWeight: font.weightHeading },
  description: { color: textAlpha[55], fontSize: 12 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bar: { flex: 1 },
  count: { color: textAlpha[55], fontSize: 12 },
  cta: { minHeight: 44 },
});
