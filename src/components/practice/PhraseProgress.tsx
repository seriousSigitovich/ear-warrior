// Where the learner is in a tune: "Phrase 3 of 7" over one segment per phrase. A done phrase is filled
// (accent when its first try was right, warm when not), the current one is outlined, the rest are
// quiet. Seeing the end come closer is what keeps a long tune going (goal gradient).
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AttemptGrade } from '../../models';
import { colors, textAlpha } from '../../theme/nocturne';

export interface PhraseProgressProps {
  phrases: number;
  /** The phrase in play (0-based). */
  index: number;
  /** First-try grade of each phrase answered so far. */
  grades: readonly AttemptGrade[];
  /** The whole tune is playing (before the first phrase), or the tune is done. */
  stage: 'tune' | 'phrase' | 'done';
}

export function PhraseProgress({ phrases, index, grades, stage }: PhraseProgressProps) {
  const label =
    stage === 'tune'
      ? 'Whole melody'
      : stage === 'done'
        ? `${phrases} ${phrases === 1 ? 'phrase' : 'phrases'}`
        : `Phrase ${index + 1} of ${phrases}`;
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: phrases, now: grades.length }}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={styles.bar}>
        {Array.from({ length: phrases }, (_, i) => {
          const g = grades[i];
          const current = stage === 'phrase' && i === index;
          return (
            <View
              key={i}
              style={[
                styles.segment,
                g && { backgroundColor: g.verdict === 'correct' ? colors.accent : colors.warm },
                current && !g && styles.current,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 16 },
  label: { color: textAlpha[60], fontSize: 13, letterSpacing: 0.4 },
  bar: { flexDirection: 'row', gap: 3 },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.divider,
  },
  current: { backgroundColor: colors.accent2Ramp[700] },
});
