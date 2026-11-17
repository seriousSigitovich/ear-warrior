// Musical Journey (spec 013, 024): the seven ranks on one screen. A rank is reached by XP alone, so each shows its XP and
// whether it has been reached. The server says what the ranks are and where the learner stands.
import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Card } from '../src/components/common/Card';
import { Kicker } from '../src/components/common/Kicker';
import { Screen } from '../src/components/common/Screen';
import { View } from 'react-native';
import { RankCard } from '../src/components/progress/RankCard';
import { RankIcon } from '../src/components/gamification/RankIcon';
import { useRewards } from '../src/features/rewards/useRewards';
import { colors, font, textAlpha } from '../src/theme/nocturne';

export default function Journey() {
  const rewards = useRewards();

  return (
    <Screen edges={['bottom']}>
      <Kicker>Musical journey</Kicker>
      <Text style={styles.title}>Ranks</Text>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {rewards ? (
          <>
            <RankCard rank={rewards.rank} xp={rewards.totalXp} />

            <Text style={styles.section}>All ranks</Text>
            {rewards.ranks.map((r, i) => {
              const reached = i <= rewards.rank.index;
              const current = i === rewards.rank.index;
              return (
                <Card
                  key={r.id}
                  style={[styles.rank, current ? styles.current : {}]}
                  accessible
                  accessibilityLabel={`${r.name}. ${reached ? (current ? 'Current rank' : 'Unlocked') : 'Locked'}. ${r.xp} XP.`}
                >
                  <RankIcon rankId={r.id} size={48} locked={!reached} />
                  <View style={styles.rankText}>
                    <View style={styles.rankHead}>
                      <Text style={[styles.rankName, !reached && styles.lockedText]}>{r.name}</Text>
                      <Text style={styles.here}>
                        {current ? 'You are here' : reached ? '✓ Unlocked' : 'Locked'}
                      </Text>
                    </View>
                    <Text style={styles.req}>
                      <Text style={reached ? styles.met : undefined}>{r.xp} XP</Text>
                    </Text>
                  </View>
                </Card>
              );
            })}
          </>
        ) : (
          <Text style={styles.muted}>Loading…</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: font.weightHeading,
    marginTop: 6,
    marginBottom: 20,
  },
  scroll: { flex: 1 },
  body: { gap: 10, paddingBottom: 24 },
  muted: { color: textAlpha[65], fontSize: 14 },
  section: {
    color: colors.accent,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 14,
  },
  rank: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rankText: { flex: 1, gap: 4 },
  current: { borderColor: colors.accent },
  rankHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  rankName: { color: colors.text, fontSize: 16, fontWeight: font.weightHeading },
  lockedText: { color: textAlpha[65] },
  here: { color: textAlpha[55], fontSize: 12 },
  req: { color: textAlpha[55], fontSize: 12 },
  met: { color: colors.accentRamp[300] },
});
