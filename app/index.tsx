// Home screen (T035): start a practice session and navigate into the core loop.
// Redesigned onto Nocturne — hero heading, waveform motif, quick stats, outlined actions.
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MAX_RANK } from '../src/services/melody/levels';
import { DEFAULT_DIFFICULTY_SETTINGS, effectiveRank } from '../src/features/difficulty/adapt';
import { KEY_VALUE_TABLE, defaultRowStore } from '../src/services/storage/db';
import { keyValueOverRowStore } from '../src/lib/deviceId';
import { isOnboarded } from '../src/lib/onboarding';
import { getDifficultyRepository } from '../src/features/difficulty/difficultyRepository';
import { heroScale, scaled } from '../src/lib/heroScale';
import { daysLabel, practiceStreak } from '../src/lib/streak';
import { useHistory } from '../src/features/progress/useHistory';
import { Screen } from '../src/components/common/Screen';
import { Button } from '../src/components/common/Button';
import { Card } from '../src/components/common/Card';
import { Kicker } from '../src/components/common/Kicker';
import { Waveform, HERO_BARS } from '../src/components/common/Waveform';
import { ensureAuthReady, getAuthService } from '../src/features/auth/authService';
import { colors, font, textAlpha } from '../src/theme/nocturne';

export default function Home() {
  const router = useRouter();
  const [rank, setRank] = useState(effectiveRank(DEFAULT_DIFFICULTY_SETTINGS));
  // The hero block grows on tall phones instead of leaving most of the screen empty.
  const s = heroScale(useWindowDimensions().height);
  // The habit, from the tunes finished on this device: re-read on focus, so it is fresh after practice.
  const { attempts } = useHistory();
  const streak = useMemo(
    () =>
      practiceStreak(
        attempts.map((a) => a.createdAt),
        new Date(),
      ),
    [attempts],
  );

  // Re-read on every focus, not just first mount: expo-router keeps this screen mounted while the
  // Difficulty screen is pushed on top, so a mount-only effect would show a stale level after the
  // learner changes difficulty and navigates back.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getDifficultyRepository()
        .load()
        .then((s) => {
          if (!cancelled) setRank(effectiveRank(s));
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // First launch: the first melody, then the sign-in offer (spec 005 FR-003) — each once, never blocking (both
  // have Skip). On focus rather than mount, so the offer follows onboarding when it pops back to Home.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const kv = keyValueOverRowStore(defaultRowStore(), KEY_VALUE_TABLE);
      void isOnboarded(kv).then(async (onboarded) => {
        if (cancelled) return;
        if (!onboarded) {
          // No screens to read: the first run is the first melody, coached as it is played.
          router.push('/first-melody');
          return;
        }
        await ensureAuthReady();
        if ((await getAuthService().shouldOfferSignIn()) && !cancelled) router.push('/sign-in');
      });
      return () => {
        cancelled = true;
      };
    }, [router]),
  );

  return (
    <Screen style={styles.screen}>
      <Kicker style={{ fontSize: scaled(11, s) }}>Ear Warrior</Kicker>
      <Text style={[styles.title, { fontSize: scaled(30, s), lineHeight: scaled(35, s) }]}>
        Hear it.{'\n'}Play it back.{'\n'}Nail it.
      </Text>
      <Text
        style={[
          styles.blurb,
          { fontSize: scaled(14, s), lineHeight: scaled(22, s), maxWidth: scaled(280, s) },
        ]}
      >
        A short melody plays. You find it on the fretboard by ear. We tell you exactly which notes
        landed.
      </Text>

      <Waveform
        bars={HERO_BARS}
        height={scaled(48, s)}
        barWidth={scaled(5, s)}
        gap={scaled(4, s)}
        breathe
        style={styles.wave}
      />

      <View style={styles.spacer} />

      {/* All three are read from what is stored: the level from the difficulty state, the streak and
          today's count from the finished tunes on record. Nothing here is invented. */}
      <View style={styles.statRow}>
        <Card style={styles.stat}>
          <Text style={styles.statKicker}>Level</Text>
          <Text style={styles.statValue}>
            {rank} of {MAX_RANK}
          </Text>
        </Card>
        <Card style={styles.stat} accessibilityLabel={`Streak: ${daysLabel(streak.days)} in a row`}>
          <Text style={styles.statKicker}>Streak</Text>
          <Text style={styles.statValue}>{daysLabel(streak.days)}</Text>
        </Card>
        <Card
          style={styles.stat}
          accessibilityLabel={`Today: ${streak.today} of ${streak.goal} melodies`}
        >
          <Text style={styles.statKicker}>Today</Text>
          <Text style={[styles.statValue, streak.goalMet && styles.statDone]}>
            {streak.today} of {streak.goal}
          </Text>
        </Card>
      </View>

      <Button
        label="Start practice"
        glow
        onPress={() => router.push('/practice')}
        style={styles.cta}
      />
      <View style={styles.secondaryRow}>
        <Button
          label="Melodies"
          variant="secondary"
          onPress={() => router.push('/melodies')}
          style={styles.grow}
        />
        <Button
          label="Progress"
          variant="secondary"
          onPress={() => router.push('/progress')}
          style={styles.grow}
        />
        <Button
          label="Settings"
          variant="secondary"
          onPress={() => router.push('/settings')}
          style={styles.grow}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: 40 },
  title: {
    color: colors.text,
    fontWeight: font.weightHeading,
    marginTop: 8,
    marginBottom: 10,
  },
  blurb: { color: textAlpha[65] },
  wave: { marginTop: 28 },
  spacer: { flex: 1 },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  stat: { flex: 1, paddingVertical: 14, paddingHorizontal: 12 },
  statKicker: {
    color: colors.accent,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statValue: { color: colors.text, fontSize: 19, fontWeight: font.weightHeading },
  statDone: { color: colors.accentRamp[300] },
  cta: { minHeight: 52 },
  secondaryRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  grow: { flex: 1, paddingHorizontal: 6 },
});
