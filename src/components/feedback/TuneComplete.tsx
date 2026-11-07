// Closing card of a tune: the tune is named (the reveal is part of the payoff) and summed up — phrases
// right first time and notes matched — while it plays whole once more.
import React, { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { tuneSummary } from '../../lib/phrases';
import { AttemptGrade } from '../../models';
import { Card } from '../common/Card';
import { colors, font, textAlpha } from '../../theme/nocturne';

export interface TuneCompleteProps {
  title?: string;
  /** First-try grade of each phrase. */
  grades: readonly AttemptGrade[];
}

export function TuneComplete({ title, grades }: TuneCompleteProps) {
  const s = tuneSummary(grades);
  const all = s.phrasesRight === s.phrases;
  const headline = title ?? 'Melody done';
  const phrasesLine = `${s.phrasesRight} of ${s.phrases} ${s.phrases === 1 ? 'phrase' : 'phrases'} right first time`;
  const notesLine = `${s.notesMatched} of ${s.notes} notes`;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${headline}. ${phrasesLine}. ${notesLine}.`);
  }, [headline, phrasesLine, notesLine]);

  return (
    <Card elevated style={styles.card}>
      <Text style={styles.kicker}>{all ? 'You played it all' : 'You played it through'}</Text>
      <Text style={styles.title}>{headline}</Text>
      <View style={styles.lines}>
        <Text style={styles.line}>{phrasesLine}</Text>
        <Text style={styles.line}>{notesLine}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 18, paddingHorizontal: 18, gap: 6 },
  kicker: { color: colors.accent, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: font.weightHeading },
  lines: { gap: 2, marginTop: 4 },
  line: { color: textAlpha[60], fontSize: 14 },
});
