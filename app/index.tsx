// Home screen (T035): start a practice session and navigate into the core loop.
// Redesigned onto Nocturne — hero heading, waveform motif, the reward standing (spec 013), outlined actions.
import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { KEY_VALUE_TABLE, defaultRowStore } from '../src/services/storage/db';
import { keyValueOverRowStore } from '../src/lib/deviceId';
import { isOnboarded } from '../src/lib/onboarding';
import { heroScale, isCompact, scaled } from '../src/lib/heroScale';
import { daysLabel } from '../src/lib/streak';
import { useGamification } from '../src/features/gamification/useGamification';
import { AttentionDot } from '../src/components/gamification/AttentionDot';
import { Flame } from '../src/components/gamification/Flame';
import { challengesLeft } from '../src/lib/gamification';
import { RankCard } from '../src/components/progress/RankCard';
import { Screen } from '../src/components/common/Screen';
import { Button } from '../src/components/common/Button';
import { Kicker } from '../src/components/common/Kicker';
import { Waveform, HERO_BARS } from '../src/components/common/Waveform';
import { ensureAuthReady, getAuthService } from '../src/features/auth/authService';
import { colors, font, radius, textAlpha, withAlpha } from '../src/theme/nocturne';

export default function Home() {
  const router = useRouter();
  // The hero block grows on tall phones instead of leaving most of the screen empty.
  const windowHeight = useWindowDimensions().height;
  const s = heroScale(windowHeight);
  // On a short phone the waveform goes and the padding shrinks, so the four buttons stay on screen.
  const compact = isCompact(windowHeight);
  // The standing (rank, XP, streak, challenges): re-read on focus, so it is fresh after practice.
  const game = useGamification();
  const challengesDone = game?.challenges.filter((c) => c.completed).length ?? 0;
  const challengesTotal = game?.challenges.length ?? 3;
  // Nothing is marked until the standing has loaded: never a dot that then disappears.
  const left = game ? challengesLeft(game.challenges) : 0;

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
    <Screen style={compact ? styles.screenCompact : styles.screen}>
      {/* Scrolls only on a window too short even for the compact layout, never cutting a button off. */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
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

        {compact ? null : (
          <Waveform
            bars={HERO_BARS}
            height={scaled(48, s)}
            barWidth={scaled(5, s)}
            gap={scaled(4, s)}
            breathe
            style={styles.wave}
          />
        )}

        <View style={styles.spacer} />

        {/* Read from what is stored by the reward service: nothing here is invented. The training itself
          stays the biggest thing on the screen. */}
        {game ? (
          <View style={styles.standing}>
            <RankCard rank={game.rank} onPress={() => router.push('/journey')} />
            <View style={styles.statRow}>
              <View
                style={styles.stat}
                accessible
                accessibilityLabel={`Streak: ${daysLabel(game.streak.days)} in a row`}
              >
                <Text style={styles.statKicker}>Streak</Text>
                <View style={styles.statLine}>
                  <Flame size={18} />
                  <Text style={styles.statValue}>{daysLabel(game.streak.days)}</Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Daily challenges: ${challengesDone} of ${challengesTotal} done${
                  left > 0 ? `, ${left} left` : ''
                }`}
                onPress={() => router.push('/challenges')}
                style={({ pressed }) => [styles.stat, pressed && styles.statPressed]}
              >
                {left > 0 ? <AttentionDot /> : null}
                <Text style={styles.statKicker}>Daily challenges</Text>
                <Text
                  style={[styles.statValue, challengesDone === challengesTotal && styles.statDone]}
                >
                  {challengesDone} of {challengesTotal}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

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
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: 40 },
  screenCompact: { paddingTop: 12 },
  // A little room at the sides so the attention dot on the challenges card, which sits half outside it, is not cut.
  flex: { flex: 1, marginHorizontal: -8 },
  scroll: { flexGrow: 1, paddingHorizontal: 8 },
  title: {
    color: colors.text,
    fontWeight: font.weightHeading,
    marginTop: 8,
    marginBottom: 10,
  },
  blurb: { color: textAlpha[65] },
  wave: { marginTop: 28 },
  spacer: { flex: 1 },
  standing: { gap: 10, marginBottom: 16 },
  statRow: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 2,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  statPressed: { backgroundColor: withAlpha(colors.accent, 0.14) },
  statLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
