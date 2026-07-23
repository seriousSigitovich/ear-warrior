// Verdict card (T031, FR-006): overall correct / not-quite summary with a matched-note count.
// Redesign: an elevated card with a round status glyph — accent check for correct, warm cross
// for not-quite. Low-confidence / timeout are handled separately by <RetryState/>.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AttemptGrade } from '../../models';
import { Card } from '../common/Card';
import { colors, font, textAlpha, withAlpha } from '../../theme/nocturne';

export function VerdictBanner({ grade }: { grade: AttemptGrade }) {
  const correct = grade.verdict === 'correct';
  const total = grade.noteResults.filter((r) => r.targetIndex !== null).length;
  const matched = grade.noteResults.filter((r) => r.status === 'matched').length;
  const hue = correct ? colors.accent : colors.warm;

  return (
    <Card elevated style={styles.card}>
      <View style={[styles.badge, { backgroundColor: withAlpha(hue, 0.16) }]}>
        <Text style={[styles.glyph, { color: correct ? colors.accentRamp[300] : colors.warm }]}>
          {correct ? '✓' : '✕'}
        </Text>
      </View>
      <View>
        <Text style={styles.title}>{correct ? 'Correct' : 'Not quite'}</Text>
        <Text style={styles.subtitle}>
          {matched} of {total} notes matched
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  badge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 16, fontWeight: '700', lineHeight: 20 },
  title: { color: colors.text, fontSize: 15, fontWeight: font.weightHeading },
  subtitle: { color: textAlpha[55], fontSize: 12, marginTop: 2 },
});
