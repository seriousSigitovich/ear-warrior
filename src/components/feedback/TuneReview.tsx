// A finished tune at a glance: the tune as a strip of small cells, one per note (landed, wrong, not
// played), a one-line count of the misses, and the first wrong notes as chips — "place · played →
// right note". Notes that were not played are only counted and shown in the strip: a list of them
// says nothing the strip does not. Shown on the tune's closing card.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Mistake, StripNote, missSummary, mistakeChip } from '../../lib/review';
import { colors, font, radius, textAlpha, withAlpha } from '../../theme/nocturne';

export interface TuneReviewProps {
  strip: readonly StripNote[];
  mistakes: readonly Mistake[];
  /** Wrong-note chips shown before the rest are only counted. */
  shown?: number;
}

export function TuneReview({ strip, mistakes, shown = 8 }: TuneReviewProps) {
  const wrong = mistakes.filter((m) => m.kind === 'wrong');
  const visible = wrong.slice(0, shown);
  const folded = wrong.length - visible.length;
  const summary = missSummary(mistakes);

  return (
    <View style={styles.wrap}>
      <View
        style={styles.strip}
        accessible
        accessibilityLabel={`${strip.length} notes. ${summary}.`}
      >
        {strip.map((s, i) => (
          <View
            key={i}
            style={[
              styles.cell,
              s === 'matched' && styles.matched,
              s === 'wrong' && styles.wrong,
              s === 'missed' && styles.missed,
            ]}
          />
        ))}
      </View>
      <Text style={styles.summary}>{summary}</Text>

      {wrong.length > 0 ? (
        <View style={styles.chips}>
          {visible.map((m, i) => (
            <View
              key={i}
              style={styles.chip}
              accessible
              accessibilityLabel={`Note ${m.position}: you played ${m.played}, it was ${m.expected}${
                m.octave ? ', wrong octave' : ''
              }`}
            >
              <Text style={styles.chipText}>
                {mistakeChip(m)}
                {m.octave ? ' (8ve)' : ''}
              </Text>
            </View>
          ))}
          {folded > 0 ? (
            <View style={styles.more}>
              <Text style={styles.moreQuiet}>+{folded} more</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  cell: { width: 9, height: 9, borderRadius: 2 },
  matched: { backgroundColor: colors.accent },
  wrong: { backgroundColor: colors.warm },
  missed: { borderWidth: 1, borderColor: colors.neutral[700] },
  summary: { color: textAlpha[60], fontSize: 12 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.warmBorder,
    backgroundColor: withAlpha(colors.warm, 0.1),
  },
  chipText: { color: colors.warm, fontSize: 12, fontWeight: font.weightHeading },
  more: { paddingVertical: 5, paddingHorizontal: 4, justifyContent: 'center' },
  moreQuiet: { color: textAlpha[50], fontSize: 12 },
});
