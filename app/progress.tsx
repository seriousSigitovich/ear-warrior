// Progress screen (spec 010): what the finished tunes say about the learner's ear, and what to do about
// it. Accuracy is counted per note (a tune with one wrong note is a good tune, not a failed one); the
// ear is mapped by kind of melodic move, weakest first, with melodies to practise the weakest on; the
// wrong notes are summed up in plain sentences; then the library, and the latest tunes note by note.
// Every figure is derived from stored attempts by unit-tested pure functions (lib/insights, lib/streak,
// lib/review, services/melody/catalog) — before any tune is finished the screen shows an empty state,
// never invented numbers.
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../src/components/common/Screen';
import { Kicker } from '../src/components/common/Kicker';
import { Card } from '../src/components/common/Card';
import { Button } from '../src/components/common/Button';
import { TrendLine } from '../src/components/common/TrendLine';
import { useHistory } from '../src/features/progress/useHistory';
import {
  IntervalStat,
  intervalStats,
  missPatterns,
  noteAccuracy,
  noteEvents,
  weakestInterval,
} from '../src/lib/insights';
import { AttemptReview, recentReviews } from '../src/lib/review';
import { daysLabel, practiceStreak } from '../src/lib/streak';
import { libraryCatalog, tuneAsk, tunesForInterval } from '../src/services/melody/catalog';
import { colors, font, radius, textAlpha, withAlpha } from '../src/theme/nocturne';

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

/** A thin bar filled to `pct`; warm while the figure is weak, accent once it is not. */
function Bar({ pct, weak }: { pct: number; weak?: boolean }) {
  return (
    <View style={styles.bar}>
      <View
        style={[
          styles.barFill,
          { width: `${Math.max(0, Math.min(100, pct))}%` },
          weak && styles.barWeak,
        ]}
      />
    </View>
  );
}

/** One kind of melodic move: how often the note after it is landed. */
function IntervalRow({ stat, weak }: { stat: IntervalStat; weak: boolean }) {
  return (
    <View
      style={styles.intervalRow}
      accessible
      accessibilityLabel={`${stat.label}: ${stat.pct} percent of ${stat.tries} notes`}
    >
      <View style={styles.intervalHead}>
        <Text style={styles.intervalLabel}>{stat.label}</Text>
        <Text style={[styles.intervalPct, weak && styles.weakText]}>{stat.pct}%</Text>
      </View>
      <Bar pct={stat.pct} weak={weak} />
      <Text style={styles.intervalTries}>
        {stat.hits} of {stat.tries} notes
      </Text>
    </View>
  );
}

/** One finished tune: its name, score, and how each of its phrases went. */
function ReviewCard({ review, now }: { review: AttemptReview; now: Date }) {
  const { score, phrases } = review;
  const right = phrases.filter((p) => p.pct === 100).length;
  const phrasesLine = `${right} of ${phrases.length} ${phrases.length === 1 ? 'phrase' : 'phrases'} right`;
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
        {dayLabel(review.at, now)} · {score.matched} of {score.notes} notes · {phrasesLine}
      </Text>
      <View
        style={styles.phraseBar}
        accessible
        accessibilityLabel={phrases
          .map((p, i) => `Phrase ${i + 1}: ${p.matched} of ${p.notes} notes`)
          .join('. ')}
      >
        {phrases.map((p, i) => (
          <View key={i} style={styles.phraseSegment}>
            <View
              style={[
                styles.phraseFill,
                { width: `${p.pct}%` },
                p.pct < 100 && styles.phrasePartial,
              ]}
            />
          </View>
        ))}
      </View>
    </Card>
  );
}

export default function Progress() {
  const router = useRouter();
  const { attempts, melodies, loading } = useHistory();
  const now = new Date();

  const insight = useMemo(() => {
    const at = new Date();
    const events = noteEvents(attempts, melodies);
    const map = intervalStats(events);
    const weakest = weakestInterval(map.stats);
    const levels = libraryCatalog(attempts);
    return {
      accuracy: noteAccuracy(attempts, at),
      map,
      weakest,
      picks: weakest ? tunesForInterval(weakest.kind, attempts) : [],
      patterns: missPatterns(events),
      levels,
      played: levels.reduce((n, l) => n + l.played, 0),
      perfect: levels.reduce((n, l) => n + l.perfect, 0),
      total: levels.reduce((n, l) => n + l.tunes.length, 0),
      reviews: recentReviews(attempts, melodies, 10),
      streak: practiceStreak(
        attempts.map((a) => a.createdAt),
        at,
      ),
    };
  }, [attempts, melodies]);

  const { accuracy, map, weakest, picks, patterns, levels, reviews, streak } = insight;
  const headline = accuracy.week ?? accuracy.all;
  const practise = (tune: string) => router.push({ pathname: '/practice', params: { tune } });

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
        ) : attempts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No melodies yet</Text>
            <Text style={styles.muted}>
              Finish a melody and this page will show how many notes you land, which moves of a
              melody are hardest for your ear, and what to practise next.
            </Text>
          </Card>
        ) : (
          <>
            {headline ? (
              <View style={styles.section}>
                <View style={styles.headline}>
                  <Text
                    style={styles.big}
                    accessibilityLabel={`${headline.pct} percent of notes right`}
                  >
                    {headline.pct}%
                  </Text>
                  {accuracy.delta !== null && accuracy.delta !== 0 ? (
                    <Text style={[styles.delta, accuracy.delta < 0 && styles.deltaDown]}>
                      {accuracy.delta > 0 ? '+' : ''}
                      {accuracy.delta}% vs the week before
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.caption}>
                  Notes right — {accuracy.week ? 'last 7 days' : 'all time'} · {headline.matched} of{' '}
                  {headline.notes}
                </Text>
                {accuracy.byDay.length > 1 ? (
                  <Card style={styles.chartCard}>
                    <TrendLine values={accuracy.byDay.map((d) => d.pct / 100)} height={100} />
                    <Text style={styles.chartCaption}>
                      Notes right per practice day · {accuracy.byDay.length} days
                    </Text>
                  </Card>
                ) : null}
              </View>
            ) : null}

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

            <Card style={styles.card}>
              <Text style={styles.cardTitle}>Your ear, move by move</Text>
              <Text style={styles.cardLead}>
                How often you land a note, by how the melody got to it. Weakest first.
              </Text>
              {map.stats.length === 0 ? (
                <Text style={styles.muted}>
                  Not enough notes yet. A few more melodies and the map fills in.
                </Text>
              ) : (
                map.stats.map((s) => (
                  <IntervalRow key={s.kind} stat={s} weak={s.kind === weakest?.kind} />
                ))
              )}
              {map.stats.length > 0 && map.thin > 0 ? (
                <Text style={styles.footnote}>
                  {map.thin} more {map.thin === 1 ? 'kind of move needs' : 'kinds of move need'} a
                  few more notes before they show.
                </Text>
              ) : null}
            </Card>

            {map.stats.length > 0 ? (
              <Card style={styles.card}>
                {weakest ? (
                  <>
                    <Text style={styles.cardTitle}>Practise: {weakest.label.toLowerCase()}</Text>
                    <Text style={styles.cardLead}>
                      Your weakest move. These melodies are full of it.
                    </Text>
                    {picks.length === 0 ? (
                      <Text style={styles.muted}>
                        No melody near your level has enough of it yet.
                      </Text>
                    ) : (
                      picks.map(({ tune, count }) => (
                        <Pressable
                          key={tune.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Practise ${tune.name}. ${count} ${weakest.label.toLowerCase()}. ${tuneAsk(tune)}`}
                          onPress={() => practise(tune.id)}
                          style={({ pressed }) => [styles.pick, pressed && styles.pickPressed]}
                        >
                          <View style={styles.pickText}>
                            <Text style={styles.pickName} numberOfLines={1}>
                              {tune.name}
                            </Text>
                            <Text style={styles.pickMeta}>
                              {count} × {weakest.label.toLowerCase()} · Level {tune.rank} ·{' '}
                              {tune.notes} notes
                            </Text>
                          </View>
                          <Text style={styles.pickGo}>Play</Text>
                        </Pressable>
                      ))
                    )}
                  </>
                ) : (
                  <>
                    <Text style={styles.cardTitle}>No weak spot yet</Text>
                    <Text style={styles.muted}>
                      Every move you have enough notes for is landing. Keep going, or try a level
                      up.
                    </Text>
                  </>
                )}
              </Card>
            ) : null}

            {patterns.length > 0 ? (
              <Card style={styles.card}>
                <Text style={styles.cardTitle}>How your misses go</Text>
                {patterns.map((p) => (
                  <Text key={p} style={styles.pattern}>
                    {p}
                  </Text>
                ))}
              </Card>
            ) : null}

            <Card style={styles.card}>
              <View style={styles.libraryHead}>
                <Text style={styles.cardTitle}>Library</Text>
                <Text style={styles.libraryTotal}>
                  {insight.played} of {insight.total} played · {insight.perfect} at 100%
                </Text>
              </View>
              {levels.map((l) => (
                <View
                  key={l.rank}
                  style={styles.levelRow}
                  accessible
                  accessibilityLabel={`Level ${l.rank}: ${l.played} of ${l.tunes.length} played, ${l.perfect} at 100 percent`}
                >
                  <Text style={styles.levelLabel}>L{l.rank}</Text>
                  <View style={styles.levelBar}>
                    <Bar pct={(l.played / l.tunes.length) * 100} />
                  </View>
                  <Text style={styles.levelCount}>
                    {l.played}/{l.tunes.length}
                  </Text>
                </View>
              ))}
              <Button
                label="All melodies"
                variant="secondary"
                onPress={() => router.push('/melodies')}
                style={styles.libraryButton}
              />
            </Card>

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
  scroll: { flex: 1, marginBottom: 12 },
  scrollBody: { paddingBottom: 18, gap: 14 },

  emptyCard: { padding: 20, gap: 8 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: font.weightHeading },

  section: { gap: 6 },
  headline: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  big: { color: colors.text, fontSize: 40, fontWeight: font.weightHeading },
  delta: { color: colors.accentRamp[300], fontSize: 13 },
  deltaDown: { color: textAlpha[55] },
  caption: { color: textAlpha[55], fontSize: 12 },
  chartCard: { padding: 16, marginTop: 8, gap: 8 },
  chartCaption: { color: textAlpha[50], fontSize: 11 },

  statRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, paddingVertical: 14, paddingHorizontal: 12 },
  statKicker: { color: colors.accent, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  statValue: { color: colors.text, fontSize: 19, fontWeight: font.weightHeading },

  card: { padding: 16, gap: 10 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: font.weightHeading },
  cardLead: { color: textAlpha[55], fontSize: 12, lineHeight: 17, marginTop: -4 },
  footnote: { color: textAlpha[50], fontSize: 12 },

  bar: { height: 5, borderRadius: 3, backgroundColor: colors.divider, overflow: 'hidden' },
  barFill: { height: 5, borderRadius: 3, backgroundColor: colors.accent },
  barWeak: { backgroundColor: colors.warm },

  intervalRow: { gap: 5 },
  intervalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  intervalLabel: { color: textAlpha[70], fontSize: 13 },
  intervalPct: { color: colors.accent, fontSize: 13, fontWeight: font.weightHeading },
  weakText: { color: colors.warm },
  intervalTries: { color: textAlpha[45], fontSize: 11 },

  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  pickPressed: { backgroundColor: withAlpha(colors.accent, 0.14) },
  pickText: { flex: 1, gap: 3 },
  pickName: { color: colors.text, fontSize: 14, fontWeight: font.weightHeading },
  pickMeta: { color: textAlpha[55], fontSize: 12 },
  pickGo: { color: colors.accent, fontSize: 14, fontWeight: font.weightHeading },

  pattern: { color: textAlpha[70], fontSize: 13, lineHeight: 19 },

  libraryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  libraryTotal: { color: textAlpha[55], fontSize: 12 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  levelLabel: { color: textAlpha[60], fontSize: 12, width: 20 },
  levelBar: { flex: 1 },
  levelCount: { color: textAlpha[55], fontSize: 12, width: 38, textAlign: 'right' },
  libraryButton: { marginTop: 4 },

  reviews: { gap: 10, marginTop: 4 },
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
  reviewMeta: { color: textAlpha[55], fontSize: 12, marginBottom: 6 },
  // One segment per phrase, filled by the share of its notes landed: accent when all, warm when part.
  phraseBar: { flexDirection: 'row', gap: 3 },
  phraseSegment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.divider,
    overflow: 'hidden',
  },
  phraseFill: { height: 6, backgroundColor: colors.accent },
  phrasePartial: { backgroundColor: colors.warm },

  cta: { minHeight: 52 },
});
