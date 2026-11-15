// Home screen (T035), reworked in spec 023: the melody to continue over six strings that move and sound when
// touched, one main button, a strip of the standing, and a bottom bar.
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { KEY_VALUE_TABLE, defaultRowStore } from '../src/services/storage/db';
import { keyValueOverRowStore } from '../src/lib/deviceId';
import { isOnboarded } from '../src/lib/onboarding';
import { openStringMidi } from '../src/lib/openStrings';
import { daysLabel, weekPracticeDays } from '../src/lib/streak';
import { useGamification } from '../src/features/gamification/useGamification';
import { useContinueTarget } from '../src/features/progress/useContinueTarget';
import { catalogTune } from '../src/services/melody/catalog';
import { createAudioPlayback } from '../src/services/audio/playback';
import { createAudioSession } from '../src/services/audio/session';
import { AttentionDot } from '../src/components/gamification/AttentionDot';
import { Flame } from '../src/components/gamification/Flame';
import { challengesLeft } from '../src/lib/gamification';
import { HomeNavBar } from '../src/components/home/HomeNavBar';
import { StringsHero } from '../src/components/home/StringsHero';
import { Screen } from '../src/components/common/Screen';
import { Button } from '../src/components/common/Button';
import { Kicker } from '../src/components/common/Kicker';
import { ensureAuthReady, getAuthService } from '../src/features/auth/authService';
import { colors, font, textAlpha, withAlpha } from '../src/theme/nocturne';

// Daily challenges are hidden for now (unfinished); flip to true to bring them back: the strip's third item then
// shows how many are done, with its attention dot, and opens them (the old tile is in the git history).
const SHOW_DAILY_CHALLENGES = false;

export default function Home() {
  const router = useRouter();
  // The standing (rank, XP, streak, challenges): re-read on focus, so it is fresh after practice.
  const game = useGamification();
  const challengesDone = game?.challenges.filter((c) => c.completed).length ?? 0;
  const challengesTotal = game?.challenges.length ?? 3;
  const left = game ? challengesLeft(game.challenges) : 0;
  // Where Continue leads: the melody left half-way, or the one last opened even if nothing was answered in it.
  const resume = useContinueTarget();
  const resumeTune = resume ? catalogTune(resume.tuneId) : null;
  const rank = game?.rank;
  const rankXp = rank
    ? rank.next
      ? `${rank.xp} / ${rank.next.requiredXp} XP`
      : `${rank.xp} XP`
    : '';
  const weekDays = game ? weekPracticeDays(game.activeDays, game.today) : 0;

  // The open strings: a touch sounds the string (one pluck rings on while the next starts, so a strum rings together).
  const audio = useMemo(() => createAudioPlayback(), []);
  const playbackReady = useRef(false);
  useEffect(() => () => void audio.stop().catch(() => undefined), [audio]);
  const pluck = useCallback(
    (row: number) => {
      if (!playbackReady.current) {
        playbackReady.current = true;
        void createAudioSession()
          .enterPlayback()
          .catch(() => undefined);
      }
      void audio.pluck(openStringMidi(row)).catch(() => undefined);
    },
    [audio],
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
      {/* Scrolls only on a window too short for everything, never cutting a button off. */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Kicker>Ear Warrior</Kicker>
        {resume && resumeTune ? (
          <View style={styles.title}>
            <Kicker style={styles.where}>
              {resume.saved ? 'Where you stopped' : 'Last opened'}
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
            <Text style={styles.meta}>A short melody plays. Find it on the fretboard by ear.</Text>
          </View>
        )}

        <StringsHero onPluck={pluck} />

        {resume && resumeTune ? (
          <>
            <Button
              label="Continue"
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

        {game && rank ? (
          <View style={styles.strip}>
            <View
              style={styles.stat}
              accessible
              accessibilityLabel={`Streak: ${daysLabel(game.streak.days)} in a row`}
            >
              <View style={styles.statLine}>
                <Flame size={16} />
                <Text style={styles.statValue}>{game.streak.days}</Text>
              </View>
              <Text style={styles.statLabel}>streak</Text>
            </View>
            <View style={styles.sep} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${rank.name}, ${rankXp}. Open ranks`}
              onPress={() => router.push('/journey')}
              style={({ pressed }) => [styles.stat, pressed && styles.pressed]}
            >
              <Text style={styles.statValue}>{rank.name}</Text>
              <Text style={styles.statLabel}>{rankXp}</Text>
            </Pressable>
            <View style={styles.sep} />
            {SHOW_DAILY_CHALLENGES ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Daily challenges: ${challengesDone} of ${challengesTotal} done${
                  left > 0 ? `, ${left} left` : ''
                }`}
                onPress={() => router.push('/challenges')}
                style={({ pressed }) => [styles.stat, pressed && styles.pressed]}
              >
                {left > 0 ? <AttentionDot /> : null}
                <Text style={styles.statValue}>
                  {challengesDone} / {challengesTotal}
                </Text>
                <Text style={styles.statLabel}>challenges</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${weekDays} ${weekDays === 1 ? 'day' : 'days'} practised this week. Open progress`}
                onPress={() => router.push('/progress')}
                style={({ pressed }) => [styles.stat, pressed && styles.pressed]}
              >
                <Text style={styles.statValue}>{weekDays}</Text>
                <Text style={styles.statLabel}>{weekDays === 1 ? 'day' : 'days'} this week</Text>
              </Pressable>
            )}
          </View>
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
  screen: { paddingTop: 12, paddingBottom: 0 },
  // A little room at the sides so the attention dot, which sits half outside its item, is not cut.
  flex: { flex: 1, marginHorizontal: -8 },
  scroll: { flexGrow: 1, paddingHorizontal: 8, paddingBottom: 8 },
  title: { marginTop: 14, marginBottom: 6 },
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
  strip: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingVertical: 4 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  pressed: { backgroundColor: withAlpha(colors.accent, 0.14) },
  statLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue: { color: colors.text, fontSize: 15, fontWeight: font.weightHeading },
  statLabel: { color: textAlpha[55], fontSize: 11 },
  sep: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: colors.divider },
});
