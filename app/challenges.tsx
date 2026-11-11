// Daily challenges (spec 013): three cards with progress and reward, and the bonus for finishing all
// three. They are the same for everyone on a given day and reset at local midnight; what counts is
// melodies completed that day. Opening the screen is the "started" analytics event, once per day.
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChallengeCard } from '../src/components/gamification/ChallengeCard';
import { Card } from '../src/components/common/Card';
import { Kicker } from '../src/components/common/Kicker';
import { Screen } from '../src/components/common/Screen';
import { Button } from '../src/components/common/Button';
import { useGamification } from '../src/features/gamification/useGamification';
import { track } from '../src/features/analytics/tracker';
import { challengeStartedEvents } from '../src/services/gamification/events';
import { getGamification } from '../src/services/gamification/instance';
import { useRouter } from 'expo-router';
import { colors, font, textAlpha } from '../src/theme/nocturne';

export default function Challenges() {
  const router = useRouter();
  const snap = useGamification();

  // The "started" event names the challenges the learner is actually shown: ask the server first (once a day).
  useEffect(() => {
    const game = getGamification();
    void (async () => {
      await game.refreshChallenges().catch(() => false);
      const shown = await game.snapshot();
      if (await game.markChallengesStarted()) {
        for (const e of challengeStartedEvents(shown.challenges)) track(e.name, e.props);
      }
    })().catch(() => undefined);
  }, []);

  const done = snap?.challenges.filter((c) => c.completed).length ?? 0;
  const bonus = snap?.allChallengesBonus ?? 0;

  return (
    <Screen edges={['bottom']}>
      <Kicker>Today</Kicker>
      <Text style={styles.title}>Daily challenges</Text>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {snap ? (
          <>
            {snap.challenges.map((c) => (
              <ChallengeCard key={c.id} challenge={c} />
            ))}
            <Card
              style={[styles.bonus, snap.allChallengesDone ? styles.bonusDone : {}]}
              accessible
              accessibilityLabel={`Daily bonus. ${snap.allChallengesDone ? 'Earned' : `${done} of ${snap.challenges.length} challenges done`}. ${bonus} XP`}
            >
              <View>
                <Text style={styles.bonusTitle}>Daily bonus</Text>
                <Text style={styles.bonusLine}>
                  {snap.allChallengesDone
                    ? '✓ All challenges done'
                    : `Finish all ${snap.challenges.length} · ${done} done`}
                </Text>
              </View>
              <Text style={styles.bonusXp}>+{bonus} XP</Text>
            </Card>
            <Text style={styles.reset}>New challenges every day at midnight.</Text>
          </>
        ) : (
          <Text style={styles.muted}>Loading…</Text>
        )}
      </ScrollView>
      <Button
        label="Start practice"
        glow
        onPress={() => router.push('/practice')}
        style={styles.cta}
      />
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
  scroll: { flex: 1, marginBottom: 12 },
  body: { gap: 12, paddingBottom: 12 },
  muted: { color: textAlpha[65], fontSize: 14 },
  bonus: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.neutral[700],
  },
  bonusDone: { borderStyle: 'solid', borderColor: colors.accentRamp[700] },
  bonusTitle: { color: colors.text, fontSize: 15, fontWeight: font.weightHeading },
  bonusLine: { color: textAlpha[55], fontSize: 12, marginTop: 3 },
  bonusXp: { color: colors.accentRamp[300], fontSize: 16, fontWeight: font.weightHeading },
  reset: { color: textAlpha[45], fontSize: 12, textAlign: 'center', marginTop: 4 },
  cta: { minHeight: 52 },
});
