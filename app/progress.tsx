// Progress screen (US3 surface, T046 / T056). Wired to real persisted history via useProgress — the
// accuracy trend, headline figure, practice volume, and weak areas all come from stored attempts, so
// nothing on this screen is fabricated (T056). Before any graded attempt exists it shows an empty
// state rather than invented numbers.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../src/components/common/Screen';
import { Kicker } from '../src/components/common/Kicker';
import { Card } from '../src/components/common/Card';
import { Button } from '../src/components/common/Button';
import { TrendLine } from '../src/components/common/TrendLine';
import { useProgress } from '../src/features/progress/useProgress';
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

export default function Progress() {
  const router = useRouter();
  const { profile, loading } = useProgress();

  const trend = profile?.accuracyTrend ?? [];
  const hasHistory = !loading && !!profile && profile.practiceVolume.totalAttempts > 0;
  const latest = trend.length > 0 ? trend[trend.length - 1].accuracyPct : null;
  const delta =
    trend.length > 1 ? trend[trend.length - 1].accuracyPct - trend[trend.length - 2].accuracyPct : null;

  return (
    <Screen>
      <Kicker>Insights</Kicker>
      <Text style={styles.title}>Progress</Text>

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
              <Text style={styles.caption}>Accuracy — last {trend.length} sessions</Text>
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
        </>
      )}

      <View style={styles.spacer} />
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
  stat: { flex: 1, padding: 14 },
  statKicker: { color: colors.accent, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  statValue: { color: colors.text, fontSize: 21, fontWeight: font.weightHeading },

  weakCard: { padding: 16, gap: 10 },
  weakTitle: { color: colors.text, fontSize: 15, fontWeight: font.weightHeading, marginBottom: 2 },
  weakRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weakLabel: { color: textAlpha[70], fontSize: 13 },
  weakRate: { color: colors.accent, fontSize: 13, fontWeight: font.weightHeading },

  spacer: { flex: 1 },
  cta: { minHeight: 52 },
});
