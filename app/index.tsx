// Home screen (T035), reworked in spec 023: the melody to continue over six strings that move and sound when
// touched, one main button, a strip of the standing, and a bottom bar.
import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { KEY_VALUE_TABLE, defaultRowStore } from '../src/services/storage/db';
import { keyValueOverRowStore } from '../src/lib/deviceId';
import { isOnboarded } from '../src/lib/onboarding';
import { lastResultOf } from '../src/lib/lastResult';
import { daysLabel } from '../src/lib/streak';
import { useRewards } from '../src/features/rewards/useRewards';
import { useLibraryVersion } from '../src/features/tunes/useLibrary';
import { useContinueTarget } from '../src/features/progress/useContinueTarget';
import { catalogTune } from '../src/services/melody/catalog';
import { AttentionDot } from '../src/components/gamification/AttentionDot';
import { Flame } from '../src/components/gamification/Flame';
import { RankIcon } from '../src/components/gamification/RankIcon';
import { HomeNavBar } from '../src/components/home/HomeNavBar';
import { LastResultBlock } from '../src/components/home/LastResultBlock';
import { Screen } from '../src/components/common/Screen';
import { Button } from '../src/components/common/Button';
import { Kicker } from '../src/components/common/Kicker';
import { ensureAuthReady, getAuthService } from '../src/features/auth/authService';
import { colors, font, radius, textAlpha, withAlpha } from '../src/theme/nocturne';

// Daily challenges are hidden for now (unfinished); flip to true to bring them back: the strip's third item then
// shows how many are done, with its attention dot, and opens them (the old tile is in the git history).
const SHOW_DAILY_CHALLENGES = false;

export default function Home() {
  const router = useRouter();
  // The standing (rank, XP, streak, challenges): re-read on focus, so it is fresh after practice.
  const game = useRewards();
  useLibraryVersion(); // the tune names come from the catalog: redraw when a newer one arrives
  const challengesDone = game?.challenges.filter((c) => c.completed).length ?? 0;
  const challengesTotal = game?.challenges.length ?? 3;
  const left = challengesTotal - challengesDone;
  // Where Continue leads: the melody left half-way, or the one last opened even if nothing was answered in it.
  const resume = useContinueTarget();
  const resumeTune = resume ? catalogTune(resume.tuneId) : null;
  // How the last phrase (or the finished attempt) of the melody on screen went, note by note: always its own.
  const result = useMemo(
    () =>
      game && resume?.last
        ? lastResultOf(
            resume.played ? 'Last attempt' : 'Last phrase',
            resume.last.results,
            resume.last.at,
            game.today,
          )
        : null,
    [game, resume],
  );
  const rank = game?.rank;
  const rankXp =
    rank && game ? (rank.next ? `${game.totalXp} / ${rank.next.xp} XP` : `${game.totalXp} XP`) : '';

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
      {/* Scrolls only on a window too short for everything, never cutting a button off. */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.header}>
          <Kicker>Ear Warrior</Kicker>
          {game && rank ? (
            <View style={styles.chips}>
              <View
                style={styles.pill}
                accessible
                accessibilityLabel={`Streak: ${daysLabel(game.streak.days)} in a row`}
              >
                <Flame size={14} />
                <Text style={styles.pillText}>{game.streak.days}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${rank.name}, ${rankXp}. Open ranks`}
                onPress={() => router.push('/journey')}
                style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
              >
                <RankIcon rankId={rank.id} size={18} />
                <Text style={styles.pillText}>{rank.name}</Text>
              </Pressable>
              {SHOW_DAILY_CHALLENGES ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Daily challenges: ${challengesDone} of ${challengesTotal} done${
                    left > 0 ? `, ${left} left` : ''
                  }`}
                  onPress={() => router.push('/challenges')}
                  style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
                >
                  {left > 0 ? <AttentionDot /> : null}
                  <Text style={styles.pillText}>
                    {challengesDone}/{challengesTotal}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
        {/* The melody and its last result sit together in the middle of the free height. */}
        <View style={styles.centre}>
          {resume && resumeTune ? (
            <View style={styles.title}>
              <Kicker style={styles.where}>
                {resume.saved ? 'Where you stopped' : resume.played ? 'Last played' : 'Last opened'}
              </Kicker>
              <Text style={styles.name} numberOfLines={2}>
                {resumeTune.name}
              </Text>
              <Text style={styles.meta}>
                Level {resumeTune.rank} · Phrase {resume.phrase + 1} of {resume.phrases}
              </Text>
            </View>
          ) : (
            <View style={styles.title}>
              <Kicker style={styles.where}>Ready when you are</Kicker>
              <Text style={styles.name}>Train your ear</Text>
              <Text style={styles.meta}>
                A short melody plays. Find it on the fretboard by ear.
              </Text>
            </View>
          )}

          <View style={styles.mid}>
            {result ? (
              <LastResultBlock result={result} />
            ) : (
              <Text style={styles.intro}>
                A short melody plays. You find it on the fretboard by ear. We tell you exactly which
                notes landed.
              </Text>
            )}
          </View>
        </View>

        {resume && resumeTune ? (
          <>
            <Button
              label={resume.played ? 'Try again' : 'Continue'}
              glow
              onPress={() =>
                router.push({
                  pathname: '/practice',
                  params: resume.saved
                    ? { tune: resume.tuneId, resume: '1' }
                    : { tune: resume.tuneId },
                })
              }
              style={styles.cta}
            />
            <Button
              label="Start something new"
              variant="ghost"
              onPress={() => router.push('/practice')}
              style={styles.link}
            />
          </>
        ) : (
          <Button
            label="Start practice"
            glow
            onPress={() => router.push('/practice')}
            style={styles.cta}
          />
        )}
      </ScrollView>
      <HomeNavBar
        items={[
          { kind: 'melodies', label: 'Melodies', onPress: () => router.push('/melodies') },
          { kind: 'progress', label: 'Progress', onPress: () => router.push('/progress') },
          { kind: 'settings', label: 'Settings', onPress: () => router.push('/settings') },
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // No bottom padding: the nav bar sits flush on the safe area.
  screen: { paddingTop: 12, paddingBottom: 0 },
  // A little room at the sides so the attention dot, which sits half outside its item, is not cut.
  flex: { flex: 1, marginHorizontal: -8 },
  scroll: { flexGrow: 1, paddingHorizontal: 8, paddingBottom: 8 },
  title: { marginTop: 14, marginBottom: 6 },
  // The free height under the brand: the melody and the last result are centred in it, together.
  centre: { flex: 1, justifyContent: 'center', gap: 28, paddingVertical: 12 },
  mid: {},
  intro: { color: textAlpha[65], fontSize: 16, lineHeight: 24 },
  where: { fontSize: 10 },
  name: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: font.weightHeading,
    marginTop: 6,
  },
  meta: { color: textAlpha[55], fontSize: 14, marginTop: 4 },
  cta: { minHeight: 54, marginTop: 14 },
  link: { alignSelf: 'center', marginTop: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  pillText: { color: colors.text, fontSize: 13, fontWeight: font.weightHeading },
  pressed: { backgroundColor: withAlpha(colors.accent, 0.14) },
});
