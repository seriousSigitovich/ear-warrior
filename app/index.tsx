// Home screen (T035), reworked in spec 023: a compact header, one primary card (Continue or Start practice), the
// weekly activity, the rank, and a bottom bar. Everything is read from the reward service and the saved places.
import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { KEY_VALUE_TABLE, defaultRowStore } from '../src/services/storage/db';
import { keyValueOverRowStore } from '../src/lib/deviceId';
import { isOnboarded } from '../src/lib/onboarding';
import { heroScale, scaled } from '../src/lib/heroScale';
import { homeGreeting } from '../src/lib/homeCopy';
import { WEEKLY_GOAL_DAYS, weekDays, weekPracticeDays } from '../src/lib/streak';
import { useGamification } from '../src/features/gamification/useGamification';
import { useContinueTarget } from '../src/features/progress/useContinueTarget';
import { catalogTune } from '../src/services/melody/catalog';
import { DailyChallengeCard } from '../src/components/home/DailyChallengeCard';
import { HomeNavBar } from '../src/components/home/HomeNavBar';
import { PracticeCard } from '../src/components/home/PracticeCard';
import { RankXpCard } from '../src/components/home/RankXpCard';
import { WeeklyActivityCard } from '../src/components/home/WeeklyActivityCard';
import { Screen } from '../src/components/common/Screen';
import { Kicker } from '../src/components/common/Kicker';
import { ensureAuthReady, getAuthService } from '../src/features/auth/authService';
import { colors, font } from '../src/theme/nocturne';

// Daily challenges are hidden for now (unfinished); flip to true to bring them back: the Daily Challenge card
// shows the first one not done, and today's ring in the week strip counts them again.
const SHOW_DAILY_CHALLENGES = false;

export default function Home() {
  const router = useRouter();
  // The greeting grows a little on tall phones.
  const s = heroScale(useWindowDimensions().height);
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
  const openChallenge = game?.challenges.find((c) => !c.completed) ?? null;

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
      {/* Scrolls only on a window too short for the cards, never cutting a button off. */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.header}>
          <Kicker style={{ fontSize: scaled(11, s) }}>Ear Warrior</Kicker>
          <Text style={[styles.greeting, { fontSize: scaled(20, s), lineHeight: scaled(26, s) }]}>
            {homeGreeting(game?.streak ?? null)}
          </Text>
        </View>

        <PracticeCard
          resume={resume}
          tune={resumeTune}
          onContinue={() =>
            resume &&
            router.push({
              pathname: '/practice',
              params: resume.saved ? { tune: resume.tuneId, resume: '1' } : { tune: resume.tuneId },
            })
          }
          onStart={() => router.push('/practice')}
        />

        {SHOW_DAILY_CHALLENGES && openChallenge ? (
          <DailyChallengeCard challenge={openChallenge} onStart={() => router.push('/practice')} />
        ) : null}

        {game ? (
          <>
            <WeeklyActivityCard
              days={week}
              streakDays={game.streak.days}
              practised={weekPracticeDays(game.activeDays, game.today)}
              goal={WEEKLY_GOAL_DAYS}
              challengesGoal={challengesTotal || 3}
              showChallengeCount={SHOW_DAILY_CHALLENGES}
            />
            <RankXpCard rank={game.rank} onPress={() => router.push('/journey')} />
          </>
        ) : null}
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
  screen: { paddingTop: 8, paddingBottom: 0 },
  flex: { flex: 1, marginHorizontal: -8 },
  // The cards fill the column; the primary one takes the free height of a tall phone.
  scroll: { flexGrow: 1, paddingHorizontal: 8, paddingBottom: 8, gap: 8 },
  header: { marginBottom: 2 },
  greeting: { color: colors.text, fontWeight: font.weightHeading, marginTop: 0 },
});
