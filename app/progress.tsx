// Progress screen (specs 011, 013): a rank on top, then three things a beginner can act on, drawn
// rather than listed.
//   1. "Am I getting better?" — a ring of notes landed this week, against last week.
//   2. "Am I practising regularly?" — the week as seven day circles, with the streak.
//   3. "What do I play next?" — the weakest kind of move in everyday words, drawn, with one melody to
//      play.
// Every figure is derived from stored attempts by unit-tested pure functions (lib/insights, lib/streak,
// services/melody/catalog); before any tune is finished the screen shows an empty state, never
// invented numbers. The warm colour is kept for the weak move alone.
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../src/components/common/Screen';
import { Kicker } from '../src/components/common/Kicker';
import { Card } from '../src/components/common/Card';
import { Button } from '../src/components/common/Button';
import { WeekStrip } from '../src/components/progress/WeekStrip';
import { RankCard } from '../src/components/progress/RankCard';
import { MoveShape } from '../src/components/progress/MoveShape';
import { useHistory } from '../src/features/progress/useHistory';
import {
  intervalRise,
  intervalStats,
  noteEvents,
  weakSpotTitle,
  weakestInterval,
} from '../src/lib/insights';
import { weekDays } from '../src/lib/streak';
import { useGamification } from '../src/features/gamification/useGamification';
import { tunesForInterval } from '../src/services/melody/catalog';
import { colors, font, radius, textAlpha, withAlpha } from '../src/theme/nocturne';

export default function Progress() {
  const router = useRouter();
  const { attempts, melodies, loading } = useHistory();
  const game = useGamification();

  const insight = useMemo(() => {
    const map = intervalStats(noteEvents(attempts, melodies));
    const weakest = weakestInterval(map.stats);
    return {
      mapped: map.stats.length > 0,
      weakest,
      picks: weakest ? tunesForInterval(weakest.kind, attempts) : [],
    };
  }, [attempts, melodies]);

  const { mapped, weakest, picks } = insight;
  const challengesDone = game?.challenges.filter((c) => c.completed).length ?? 0;
  const challengesTotal = game?.challenges.length ?? 0;
  const week = game ? weekDays(game.activeDays, game.today, challengesDone, challengesTotal) : [];
  const streakDays = game?.streak.days ?? 0;
  const hasHistory = attempts.length > 0 || (game?.totalXp ?? 0) > 0;
  const [pick, ...others] = picks;
  const practise = (tune: string) => router.push({ pathname: '/practice', params: { tune } });

  return (
    <Screen edges={['bottom']}>
      <Kicker>Insights</Kicker>
      <Text style={styles.title}>Your progress</Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <Text style={styles.muted} accessibilityLabel="Loading your progress">
            Loading…
          </Text>
        ) : !hasHistory ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No melodies yet</Text>
            <Text style={styles.muted}>
              Finish a melody and this page will show your rank, how your week is going, and what to
              play next.
            </Text>
          </Card>
        ) : (
          <>
            {game ? <RankCard rank={game.rank} onPress={() => router.push('/journey')} /> : null}

            <Card style={styles.card}>
              <View style={styles.weekHead}>
                <Text style={styles.cardTitle}>
                  {streakDays === 0
                    ? 'Start a streak today'
                    : `${streakDays} ${streakDays === 1 ? 'day' : 'days'} in a row`}
                </Text>
                <Text style={styles.weekToday}>
                  {challengesDone >= challengesTotal && challengesTotal > 0
                    ? 'All challenges done'
                    : `${challengesDone} of ${challengesTotal} challenges`}
                </Text>
              </View>
              <WeekStrip days={week} goal={challengesTotal || 3} />
            </Card>

            <Card style={[styles.card, styles.next]}>
              <Text style={styles.nextKicker}>Next up</Text>
              {weakest ? (
                <>
                  <View style={styles.spot}>
                    <MoveShape rise={intervalRise(weakest.kind)} />
                    <View style={styles.spotText}>
                      <Text style={styles.spotTitle}>{weakSpotTitle(weakest.kind)}</Text>
                      <Text style={styles.spotCount}>
                        You land {weakest.hits} of {weakest.tries}
                      </Text>
                    </View>
                  </View>
                  {pick ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Play ${pick.tune.name}. ${pick.count} ${weakest.label.toLowerCase()}, level ${pick.tune.rank}`}
                      onPress={() => practise(pick.tune.id)}
                      style={({ pressed }) => [styles.pick, pressed && styles.pickPressed]}
                    >
                      <View style={styles.pickText}>
                        <Text style={styles.pickName} numberOfLines={1}>
                          {pick.tune.name}
                        </Text>
                        <Text style={styles.pickMeta}>
                          {pick.count} × {weakest.label.toLowerCase()} · level {pick.tune.rank}
                        </Text>
                      </View>
                      <View style={styles.play}>
                        <View style={styles.playIcon} />
                      </View>
                    </Pressable>
                  ) : (
                    <Text style={styles.muted}>
                      No melody near your level has enough of it yet. Keep playing.
                    </Text>
                  )}
                  {others.length > 0 ? (
                    <Text style={styles.others}>
                      Or try{' '}
                      {others.map((o, i) => (
                        <Text key={o.tune.id}>
                          <Text
                            accessibilityRole="link"
                            style={styles.otherLink}
                            onPress={() => practise(o.tune.id)}
                          >
                            {o.tune.name}
                          </Text>
                          {i < others.length - 1 ? ', ' : ''}
                        </Text>
                      ))}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={styles.muted}>
                  {mapped
                    ? 'Nothing is tripping you up right now. Keep going, or try a level up.'
                    : 'Play a few more melodies and this card will tell you what to practise.'}
                </Text>
              )}
            </Card>
          </>
        )}
      </ScrollView>

      <Button
        label={pick ? 'Practice something else' : 'Continue practicing'}
        variant={pick ? 'secondary' : 'primary'}
        glow={!pick}
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
  muted: { color: textAlpha[65], fontSize: 14, lineHeight: 21 },
  scroll: { flex: 1, marginBottom: 12 },
  scrollBody: { paddingBottom: 12, gap: 16 },

  emptyCard: { padding: 20, gap: 8 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: font.weightHeading },

  card: { padding: 16, gap: 14 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: font.weightHeading },
  weekHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  weekToday: { color: textAlpha[55], fontSize: 12 },

  next: { borderWidth: 1, borderColor: colors.accentRamp[700], gap: 12 },
  nextKicker: {
    color: colors.accent,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  spot: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  spotText: { flex: 1, gap: 3 },
  spotTitle: { color: colors.text, fontSize: 16, fontWeight: font.weightHeading },
  spotCount: { color: textAlpha[55], fontSize: 12 },

  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.accentRamp[900],
  },
  pickPressed: { backgroundColor: withAlpha(colors.accent, 0.28) },
  pickText: { flex: 1, gap: 3 },
  pickName: { color: colors.text, fontSize: 15, fontWeight: font.weightHeading },
  pickMeta: { color: colors.neutral[400], fontSize: 12 },
  play: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A triangle from borders; nudged right so it sits optically centred in the circle.
  playIcon: {
    width: 0,
    height: 0,
    marginLeft: 3,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 11,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.bg,
  },
  others: { color: textAlpha[55], fontSize: 12, lineHeight: 18 },
  otherLink: { color: colors.accentRamp[300] },

  cta: { minHeight: 52 },
});
