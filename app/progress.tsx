// Progress screen (US3 surface, T046). Accuracy trends, practice volume, and weak areas land
// with User Story 3; this redesign brings the screen onto Nocturne — a headline accuracy figure,
// a seven-session trend, and quick stats. Values are illustrative until US3 wires real history.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../src/components/common/Screen';
import { Kicker } from '../src/components/common/Kicker';
import { Card } from '../src/components/common/Card';
import { Button } from '../src/components/common/Button';
import { TrendLine } from '../src/components/common/TrendLine';
import { colors, font, textAlpha } from '../src/theme/nocturne';

// Seven-session accuracy trend (illustrative until US3 wires real history).
const TREND = [0.5, 0.54, 0.52, 0.62, 0.58, 0.72, 0.85];

export default function Progress() {
  const router = useRouter();
  return (
    <Screen>
      <Kicker>Insights</Kicker>
      <Text style={styles.title}>Progress</Text>

      <View style={styles.headline}>
        <Text style={styles.big}>82%</Text>
        <Text style={styles.delta}>+6% this week</Text>
      </View>
      <Text style={styles.caption}>Accuracy — last 7 sessions</Text>

      <Card style={styles.chartCard}>
        <TrendLine values={TREND} height={100} />
      </Card>

      <View style={styles.statRow}>
        <Card style={styles.stat}>
          <Text style={styles.statKicker}>Streak</Text>
          <Text style={styles.statValue}>6 days</Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={styles.statKicker}>Attempts</Text>
          <Text style={styles.statValue}>142</Text>
        </Card>
      </View>

      <View style={styles.spacer} />
      <Button label="Continue practicing" glow onPress={() => router.push('/practice')} style={styles.cta} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 26, fontWeight: font.weightHeading, marginTop: 6, marginBottom: 22 },
  headline: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 6 },
  big: { color: colors.text, fontSize: 40, fontWeight: font.weightHeading },
  delta: { color: colors.accentRamp[300], fontSize: 13 },
  caption: { color: textAlpha[55], fontSize: 12, marginBottom: 18 },

  chartCard: { padding: 16, marginBottom: 18 },

  statRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, padding: 14 },
  statKicker: { color: colors.accent, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  statValue: { color: colors.text, fontSize: 21, fontWeight: font.weightHeading },

  spacer: { flex: 1 },
  cta: { minHeight: 52 },
});
