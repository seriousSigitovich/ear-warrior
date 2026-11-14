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
  /** A phrase is in play, or the tune is done. */
  stage: 'phrase' | 'done';
  /** In the navigation bar (spec 021): centred, a fixed width, no space below. */
  compact?: boolean;
  /** Width of the compact block, dp: as wide as the navigation bar leaves it. */
  width?: number;
  /** Say this instead of "Phrase N of M" (a hint line while answering). */
  label?: string;
}

export function PhraseProgress({
  phrases,
  index,
  grades,
  stage,
  compact,
  width,
  label: override,
}: PhraseProgressProps) {
  const label =
    override ??
    (stage === 'done'
      ? `${phrases} ${phrases === 1 ? 'phrase' : 'phrases'}`
      : `Phrase ${index + 1} of ${phrases}`);
  return (
    <View
      style={[styles.wrap, compact && styles.compact, compact && width ? { width } : null]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: phrases, now: grades.length }}
    >
      <Text style={[styles.label, compact && styles.labelCompact]} numberOfLines={1}>
        {label}
      </Text>
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
  compact: { gap: 4, marginBottom: 0, width: 220, alignItems: 'stretch' },
  labelCompact: { textAlign: 'center' },
  bar: { flexDirection: 'row', gap: 3 },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.divider,
  },
  current: { backgroundColor: colors.accent2Ramp[700] },
});
