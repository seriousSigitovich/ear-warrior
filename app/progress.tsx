// Progress screen (US3 surface, T046 / T056). Wired to real persisted history via useProgress — the
// accuracy trend, headline figure, practice volume, and weak areas all come from stored attempts, so
// nothing on this screen is fabricated (T056). Before any graded attempt exists it shows an empty
// state rather than invented numbers.
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../src/components/common/Screen';
import { Kicker } from '../src/components/common/Kicker';
import { Card } from '../src/components/common/Card';
import { Button } from '../src/components/common/Button';
import { TrendLine } from '../src/components/common/TrendLine';
import { useProgress } from '../src/features/progress/useProgress';
import { useHistory } from '../src/features/progress/useHistory';
import { AttemptReview, mistakeLine, recentReviews } from '../src/lib/review';
import { daysLabel, practiceStreak } from '../src/lib/streak';
import { colors, font, textAlpha } from '../src/theme/nocturne';

/** Turn an aggregation descriptor ("length:3", "interval:leap") into a learner-facing label. */
function weakAreaLabel(descriptor: string): string {
  const [kind, value] = descriptor.split(':');
  if (kind === 'length') return `${value}-note melodies`;
  if (kind === 'interval') {
    if (value === 'step') return 'Stepwise motion';
    if (value === 'third') return 'Thirds';
    if (value === 'leap') return 'Wide leaps';
  }
  return descriptor;
}

/** "Today", "Yesterday" or "Nov 8" for a finished tune. */
function dayLabel(iso: string, now: Date): string {
  const at = new Date(iso);
  const days = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime()) /
      86400000,
  );
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** One finished tune: its name, score, and each wrong note with the note it should have been. */
function ReviewCard({ review, now }: { review: AttemptReview; now: Date }) {
  const { score, mistakes } = review;
  return (
    <Card style={styles.reviewCard}>
      <View style={styles.reviewHead}>
        <Text style={styles.reviewTitle} numberOfLines={1}>
          {review.title}
        </Text>
        <Text style={[styles.reviewScore, score.pct === 100 && styles.reviewPerfect]}>
          {score.pct}%
        </Text>
      </View>
      <Text style={styles.reviewMeta}>
        {dayLabel(review.at, now)} · {score.matched} of {score.notes} notes
      </Text>
      {mistakes.length === 0 ? (
        <Text style={styles.reviewClean}>Every note right.</Text>
      ) : (
        mistakes.map((m, i) => (
          <Text key={i} style={styles.reviewMistake}>
            {mistakeLine(m)}
          </Text>
        ))
      )}
    </Card>
  );
}

export default function Progress() {
  const router = useRouter();
  const { profile, loading } = useProgress();
  const { attempts, melodies } = useHistory();
  const now = new Date();
  const reviews = useMemo(() => recentReviews(attempts, melodies, 10), [attempts, melodies]);
  const streak = useMemo(
    () =>
      practiceStreak(
        attempts.map((a) => a.createdAt),
        new Date(),
      ),
    [attempts],
  );

  const trend = profile?.accuracyTrend ?? [];
  const hasHistory = !loading && !!profile && profile.practiceVolume.totalAttempts > 0;
  const latest = trend.length > 0 ? trend[trend.length - 1].accuracyPct : null;
  const delta =
    trend.length > 1
      ? trend[trend.length - 1].accuracyPct - trend[trend.length - 2].accuracyPct
      : null;

  return (
    <Screen edges={['bottom']}>
      <Kicker>Insights</Kicker>
      <Text style={styles.title}>Progress</Text>

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
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.muted}>
              Complete a few melodies and your accuracy trend, practice volume, and weak areas will
              show up here.
            </Text>
          </Card>
        ) : (
          <>
            {latest !== null ? (
              <>
                <View style={styles.headline}>
                  <Text style={styles.big} accessibilityLabel={`Latest accuracy ${latest} percent`}>
                    {latest}%
                  </Text>
                  {delta !== null && delta !== 0 ? (
                    <Text style={[styles.delta, delta < 0 ? styles.deltaDown : null]}>
                      {delta > 0 ? '+' : ''}
                      {delta}% vs last session
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.caption}>
                  Accuracy — last {trend.length === 1 ? 'session' : `${trend.length} sessions`}
                </Text>
              </>
            ) : (
              <Text style={styles.caption}>
                Complete a graded attempt to start your accuracy trend.
              </Text>
            )}

            {trend.length > 1 ? (
              <Card style={styles.chartCard}>
                <TrendLine values={trend.map((p) => p.accuracyPct / 100)} height={100} />
              </Card>
            ) : null}

            <View style={styles.statRow}>
              <Card style={styles.stat}>
                <Text style={styles.statKicker}>Attempts</Text>
                <Text style={styles.statValue}>{profile!.practiceVolume.totalAttempts}</Text>
              </Card>
              <Card style={styles.stat}>
                <Text style={styles.statKicker}>Sessions</Text>
                <Text style={styles.statValue}>{profile!.practiceVolume.totalSessions}</Text>
              </Card>
              <Card style={styles.stat}>
                <Text style={styles.statKicker}>Reached</Text>
                <Text style={styles.statValue}>L{profile!.difficultyReached}</Text>
              </Card>
            </View>

            <View style={styles.statRow}>
              <Card style={styles.stat}>
                <Text style={styles.statKicker}>Streak</Text>
                <Text style={styles.statValue}>{daysLabel(streak.days)}</Text>
              </Card>
              <Card style={styles.stat}>
                <Text style={styles.statKicker}>Best streak</Text>
                <Text style={styles.statValue}>{daysLabel(streak.best)}</Text>
              </Card>
              <Card style={styles.stat}>
                <Text style={styles.statKicker}>Today</Text>
                <Text style={styles.statValue}>
                  {streak.today} of {streak.goal}
                </Text>
              </Card>
            </View>

            {profile!.weakAreas.some((w) => w.missRate > 0) ? (
              <Card style={styles.weakCard}>
                <Text style={styles.weakTitle}>Weak areas</Text>
                {profile!.weakAreas
                  .filter((w) => w.missRate > 0)
                  .slice(0, 4)
                  .map((w) => (
                    <View
                      key={w.descriptor}
                      style={styles.weakRow}
                      accessibilityLabel={`${weakAreaLabel(w.descriptor)}: ${Math.round(
                        w.missRate * 100,
                      )} percent missed`}
                    >
                      <Text style={styles.weakLabel}>{weakAreaLabel(w.descriptor)}</Text>
                      <Text style={styles.weakRate}>{Math.round(w.missRate * 100)}% missed</Text>
                    </View>
                  ))}
              </Card>
            ) : null}

            {reviews.length > 0 ? (
              <View style={styles.reviews}>
                <Text style={styles.sectionTitle}>Recent melodies</Text>
                {reviews.map((r) => (
                  <ReviewCard key={r.attemptId} review={r} now={now} />
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <Button
        label="Continue practicing"
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
    marginBottom: 22,
  },
  muted: { color: textAlpha[65], fontSize: 14, lineHeight: 22 },

  emptyCard: { padding: 20, gap: 8 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: font.weightHeading },

  headline: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 6 },
  big: { color: colors.text, fontSize: 40, fontWeight: font.weightHeading },
  delta: { color: colors.accentRamp[300], fontSize: 13 },
  deltaDown: { color: textAlpha[55] },
  caption: { color: textAlpha[55], fontSize: 12, marginBottom: 18 },

  chartCard: { padding: 16, marginBottom: 18 },

  statRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  stat: { flex: 1, paddingVertical: 14, paddingHorizontal: 12 },
  statKicker: { color: colors.accent, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  statValue: { color: colors.text, fontSize: 19, fontWeight: font.weightHeading },

  weakCard: { padding: 16, gap: 10 },
  weakTitle: { color: colors.text, fontSize: 15, fontWeight: font.weightHeading, marginBottom: 2 },
  weakRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weakLabel: { color: textAlpha[70], fontSize: 13 },
  weakRate: { color: colors.accent, fontSize: 13, fontWeight: font.weightHeading },

  scroll: { flex: 1, marginBottom: 12 },
  scrollBody: { paddingBottom: 18 },

  reviews: { gap: 10, marginTop: 18 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: font.weightHeading },
  reviewCard: { padding: 16, gap: 4 },
  reviewHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  reviewTitle: { color: colors.text, fontSize: 15, fontWeight: font.weightHeading, flexShrink: 1 },
  reviewScore: { color: colors.warm, fontSize: 15, fontWeight: font.weightHeading },
  reviewPerfect: { color: colors.accent },
  reviewMeta: { color: textAlpha[55], fontSize: 12, marginBottom: 4 },
  reviewClean: { color: textAlpha[60], fontSize: 13 },
  reviewMistake: { color: textAlpha[70], fontSize: 13, lineHeight: 19 },

  cta: { minHeight: 52 },
});
