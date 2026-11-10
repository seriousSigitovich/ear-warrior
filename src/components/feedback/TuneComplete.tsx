// Closing card of a tune: a word of praise, the tune named (the reveal is part of the payoff), the
// score — notes matched, phrases right first time — the day's habit (streak and daily goal), and the
// tune note by note with the wrong notes and what they should have been. All of it while the tune
// plays whole once more. The right notes are named only here, once the tune is over: before that,
// finding them by ear is the exercise.
import React, { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { tuneSummary } from '../../lib/phrases';
import { mistakesOf, noteStrip, praise, scoreOf } from '../../lib/review';
import { Streak, streakLine } from '../../lib/streak';
import { AttemptGrade, NoteResult } from '../../models';
import { Card } from '../common/Card';
import { TuneReview } from './TuneReview';
import { colors, font, textAlpha } from '../../theme/nocturne';

/** Wrong notes shown before the rest fold into "+N more": the card must not bury the Next button. */
const MISTAKES_SHOWN = 6;

export interface TuneCompleteProps {
  title?: string;
  /** First-try grade of each phrase. */
  grades: readonly AttemptGrade[];
  /** The tune's note results on its first tries, numbered across the whole tune. */
  results?: readonly NoteResult[];
  /** The practice habit as of this tune; absent for a tune that does not count. */
  streak?: Streak;
}

export function TuneComplete({ title, grades, results, streak }: TuneCompleteProps) {
  const s = tuneSummary(grades);
  const all = results ?? grades.flatMap((g) => g.noteResults);
  const score = scoreOf(all);
  const mistakes = mistakesOf(all);
  const headline = title ?? 'Melody done';
  const kicker = praise(score.pct);
  const phrasesLine = `${s.phrasesRight} of ${s.phrases} ${s.phrases === 1 ? 'phrase' : 'phrases'} right first time`;
  const notesLine = `${score.matched} of ${score.notes} notes`;
  const habit = streak ? streakLine(streak) : null;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      `${kicker}. ${headline}. ${score.pct} percent. ${notesLine}. ${phrasesLine}.${habit ? ` ${habit}.` : ''}`,
    );
  }, [kicker, headline, score.pct, phrasesLine, notesLine, habit]);

  return (
    <>
      <Card elevated style={styles.card}>
        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={styles.title}>{headline}</Text>
        <View style={styles.scoreRow}>
          <Text style={styles.score}>{score.pct}%</Text>
          <View style={styles.lines}>
            <Text style={styles.line}>{notesLine}</Text>
            <Text style={styles.line}>{phrasesLine}</Text>
          </View>
        </View>
        {habit ? (
          <View style={styles.habit}>
            <Text style={styles.habitText}>{habit}</Text>
            {streak!.goalMet ? null : (
              <View style={styles.goal} accessibilityElementsHidden importantForAccessibility="no">
                {Array.from({ length: streak!.goal }, (_, i) => (
                  <View key={i} style={[styles.pip, i < streak!.today && styles.pipDone]} />
                ))}
              </View>
            )}
          </View>
        ) : null}
      </Card>

      {mistakes.length > 0 ? (
        <Card style={styles.mistakes}>
          <Text style={styles.mistakesTitle}>Note by note</Text>
          <TuneReview strip={noteStrip(all)} mistakes={mistakes} shown={MISTAKES_SHOWN} />
        </Card>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 18, paddingHorizontal: 18, gap: 6 },
  kicker: { color: colors.accent, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: font.weightHeading },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 },
  score: { color: colors.text, fontSize: 40, lineHeight: 46, fontWeight: font.weightHeading },
  lines: { gap: 2, flex: 1 },
  line: { color: textAlpha[60], fontSize: 14 },

  habit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  habitText: { color: colors.accentRamp[300], fontSize: 14, flexShrink: 1 },
  goal: { flexDirection: 'row', gap: 5 },
  pip: { width: 18, height: 5, borderRadius: 3, backgroundColor: colors.divider },
  pipDone: { backgroundColor: colors.accent },

  mistakes: { padding: 16, gap: 8 },
  mistakesTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: font.weightHeading,
    marginBottom: 2,
  },
});
