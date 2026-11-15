// Home screen (T035): start a practice session and navigate into the core loop.
// Redesigned onto Nocturne — hero heading, a Continue card for the melody left half-way, the week strip,
// the rank (spec 013), and a bottom bar.
import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { KEY_VALUE_TABLE, defaultRowStore } from '../src/services/storage/db';
import { keyValueOverRowStore } from '../src/lib/deviceId';
import { isOnboarded } from '../src/lib/onboarding';
import { heroScale, scaled } from '../src/lib/heroScale';
import { daysLabel, weekDays } from '../src/lib/streak';
import { useGamification } from '../src/features/gamification/useGamification';
import { Flame } from '../src/components/gamification/Flame';
import { nextRankLine } from '../src/components/progress/RankCard';
import { WeekStrip } from '../src/components/progress/WeekStrip';
import { catalogTune } from '../src/services/melody/catalog';
import { useContinueTarget } from '../src/features/progress/useContinueTarget';
import { RankIcon } from '../src/components/gamification/RankIcon';
import { HomeNavBar } from '../src/components/home/HomeNavBar';
import { Screen } from '../src/components/common/Screen';
import { Button } from '../src/components/common/Button';
import { Kicker } from '../src/components/common/Kicker';
import { ensureAuthReady, getAuthService } from '../src/features/auth/authService';
import { colors, font, radius, textAlpha, withAlpha } from '../src/theme/nocturne';

// Daily challenges are hidden for now (unfinished); flip to true to bring them back: today's ring in the week
// strip then counts them again (the old tile with its attention dot is in the git history).
const SHOW_DAILY_CHALLENGES = false;

export default function Home() {
  const router = useRouter();
  // The hero block grows on tall phones instead of leaving most of the screen empty.
  const windowHeight = useWindowDimensions().height;
  const s = heroScale(windowHeight);
  // The standing (rank, XP, streak, challenges): re-read on focus, so it is fresh after practice.
  const game = useGamification();
  const challengesDone = game?.challenges.filter((c) => c.completed).length ?? 0;
  const challengesTotal = game?.challenges.length ?? 3;
  // Where Continue leads: the melody left half-way, or the one last opened even if nothing was answered in it.
  const resume = useContinueTarget();
  const resumeTune = resume ? catalogTune(resume.tuneId) : null;
  // The week as seven circles. While the challenges are hidden today is simply filled once practised.
  const week = game
    ? weekDays(game.activeDays, game.today, challengesDone, challengesTotal).map((d) =>
        !SHOW_DAILY_CHALLENGES && d.state === 'today'
          ? { ...d, goalMet: game.streak.practicedToday }
          : d,
      )
    : [];

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
      {/* One layout for every phone: scrolls only on a window too short even for this, never cutting a button off. */}
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
          Find the melody on the fretboard by ear.
        </Text>

        {/* Read from what is stored by the reward service: nothing here is invented. The training itself
          stays the biggest thing on the screen. */}
        <View style={styles.spacer} />

        {/* The cards, pinned above the main button: Continue (when something is half-way), the week, the rank. */}
        {game || resume ? (
          <View style={styles.panel}>
            {resume && resumeTune ? (
              <View style={styles.section}>
                <Kicker style={styles.resumeKicker}>
                  {resume.saved ? 'Where you stopped' : 'Last opened'}
                </Kicker>
                <Text style={styles.resumeName} numberOfLines={1}>
                  {resumeTune.name}
                </Text>
                <Text style={styles.resumeAt}>
                  Phrase {resume.phrase + 1} of {resume.phrases}
                </Text>
                <View style={styles.segments} accessibilityElementsHidden>
                  {Array.from({ length: resume.phrases }, (_, i) => (
                    <View
                      key={i}
                      style={[styles.segment, i < resume.answered && styles.segmentDone]}
                    />
                  ))}
                </View>
                <Button
                  label="Continue"
                  onPress={() =>
                    router.push({
                      pathname: '/practice',
                      params: resume.saved
                        ? { tune: resume.tuneId, resume: '1' }
                        : { tune: resume.tuneId },
                    })
                  }
                  style={styles.resumeButton}
                />
              </View>
            ) : null}
            {game ? (
              <>
                <View style={[styles.section, styles.weekSection]}>
                  <View style={styles.weekHead}>
                    <Text style={styles.statKicker}>This week</Text>
                    <View
                      style={styles.statLine}
                      accessible
                      accessibilityLabel={`Streak: ${daysLabel(game.streak.days)} in a row`}
                    >
                      <Flame size={16} />
                      <Text style={styles.statValue}>{daysLabel(game.streak.days)}</Text>
                    </View>
                  </View>
                  <WeekStrip
                    days={week}
                    goal={challengesTotal || 3}
                    showCount={SHOW_DAILY_CHALLENGES}
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${game.rank.name}, ${game.rank.xp} XP. ${nextRankLine(game.rank)}. Open ranks`}
                  onPress={() => router.push('/journey')}
                  style={({ pressed }) => [
                    styles.section,
                    styles.rankSection,
                    pressed && styles.statPressed,
                  ]}
                >
                  <View style={styles.rankHead}>
                    <RankIcon rankId={game.rank.id} size={34} />
                    <View style={styles.rankText}>
                      <Text style={styles.rankName}>{game.rank.name}</Text>
                    </View>
                    <Text style={styles.rankXp}>{game.rank.xp} XP</Text>
                  </View>
                  <View style={styles.bar}>
                    <View style={[styles.fill, { width: `${game.rank.pct}%` }]} />
                  </View>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null}
        <Button
          label="Start practice"
          glow
          onPress={() => router.push('/practice')}
          style={styles.cta}
        />
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
  flex: { flex: 1, marginHorizontal: -8 },
  scroll: { flexGrow: 1, paddingHorizontal: 8, paddingBottom: 12 },
  title: {
    color: colors.text,
    fontWeight: font.weightHeading,
    marginTop: 8,
    marginBottom: 10,
  },
  blurb: { color: textAlpha[65] },
  spacer: { flex: 1, minHeight: 12 },
  // The cards sit together, a small gap apart.
  panel: { gap: 8, marginBottom: 12 },
  section: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14 },
  resumeKicker: { fontSize: 10 },
  resumeName: {
    color: colors.text,
    fontSize: 21,
    fontWeight: font.weightHeading,
    marginTop: 4,
  },
  resumeAt: { color: textAlpha[55], fontSize: 13, marginTop: 2, marginBottom: 12 },
  segments: { flexDirection: 'row', gap: 4, marginBottom: 14 },
  segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.divider },
  segmentDone: { backgroundColor: colors.accent },
  resumeButton: { minHeight: 46 },
  weekSection: { gap: 10 },
  weekHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rankSection: { gap: 8 },
  rankHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankText: { flex: 1 },
  rankName: { color: colors.text, fontSize: 16, fontWeight: font.weightHeading },
  rankXp: { color: colors.accentRamp[300], fontSize: 13 },
  bar: { height: 4, borderRadius: 2, backgroundColor: colors.divider, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
  statLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statKicker: {
    color: colors.accent,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statValue: { color: colors.text, fontSize: 14, fontWeight: font.weightHeading },
  statPressed: { backgroundColor: withAlpha(colors.accent, 0.14) },
  cta: { minHeight: 52 },
});
