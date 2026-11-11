// Closing card of a tune: a word of praise, the tune named (the reveal is part of the payoff), the
// score — notes matched, phrases right first time — what the melody earned (XP and where it leaves the
// rank, any level just mastered, the day's challenges and streak), and the tune note by note with the
// wrong notes and what they should have been. All of it while the tune plays whole once more. The right
// notes are named only here, once the tune is over: before that, finding them by ear is the exercise.
import React, { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { levelLabel } from '../../lib/levelLabels';
import { tuneSummary } from '../../lib/phrases';
import { mistakesOf, noteStrip, praise, scoreOf } from '../../lib/review';
import { AttemptGrade, NoteResult } from '../../models';
import { GameSummary } from '../../services/gamification/summary';
import { nextRankLine } from '../progress/RankCard';
import { Card } from '../common/Card';
import { Flame } from '../gamification/Flame';
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
  /** What the melody earned and where that leaves the learner (spec 013); absent until known. */
  game?: GameSummary | null;
}

export function TuneComplete({ title, grades, results, game }: TuneCompleteProps) {
  const s = tuneSummary(grades);
  const all = results ?? grades.flatMap((g) => g.noteResults);
  const score = scoreOf(all);
  const mistakes = mistakesOf(all);
  const headline = title ?? 'Melody done';
  const kicker = praise(score.pct);
  const phrasesLine = `${s.phrasesRight} of ${s.phrases} ${s.phrases === 1 ? 'phrase' : 'phrases'} right first time`;
  const notesLine = `${score.matched} of ${score.notes} notes`;
  const nextRank = game ? nextRankLine(game.rank) : '';
  const habit = game
    ? `${game.streakDays > 0 ? `${game.streakDays}-day streak · ` : ''}${game.challengesDone} of ${game.challengesTotal} daily challenges`
    : null;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      `${kicker}. ${headline}. ${score.pct} percent. ${notesLine}. ${phrasesLine}.${
        game && game.earnedXp > 0 ? ` ${game.earnedXp} XP.` : ''
      }${game?.masteryUnlocked.length ? ` ${game.masteryUnlocked.map(levelLabel).join(', ')} mastered.` : ''}`,
    );
  }, [kicker, headline, score.pct, phrasesLine, notesLine, game]);

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

        {game && game.earnedXp > 0 ? (
          <View style={styles.xp}>
            <View style={styles.xpRow}>
              <Text style={styles.xpEarned}>+{game.earnedXp} XP</Text>
              <Text style={styles.xpNext}>{nextRank}</Text>
            </View>
            <View
              style={styles.xpBar}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`${game.rank.name}, ${nextRank}`}
            >
              <View style={[styles.xpFill, { width: `${game.rank.pct}%` }]} />
            </View>
            {game.parts.length > 0 ? (
              <Text style={styles.xpParts}>{game.parts.join(' · ')}</Text>
            ) : null}
          </View>
        ) : null}

        {game && game.masteryUnlocked.length > 0 ? (
          <View style={styles.mastery}>
            {game.masteryUnlocked.map((level) => (
              <Text key={level} style={styles.masteryText}>
                ✓ {levelLabel(level)} mastered
              </Text>
            ))}
          </View>
        ) : null}

        {habit ? (
          <View style={styles.habit}>
            {game && game.streakDays > 0 ? <Flame size={14} /> : null}
            <Text style={styles.habitText}>{habit}</Text>
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

  xp: {
    gap: 6,
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  xpEarned: { color: colors.accent, fontSize: 18, fontWeight: font.weightHeading },
  xpNext: { color: textAlpha[60], fontSize: 12, flexShrink: 1, textAlign: 'right' },
  xpBar: { height: 5, borderRadius: 3, backgroundColor: colors.divider, overflow: 'hidden' },
  xpFill: { height: 5, borderRadius: 3, backgroundColor: colors.accent },
  xpParts: { color: textAlpha[50], fontSize: 12 },

  mastery: { marginTop: 6, gap: 2 },
  masteryText: { color: colors.accentRamp[300], fontSize: 14, fontWeight: font.weightHeading },

  habit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  habitText: { color: colors.accentRamp[300], fontSize: 14, flexShrink: 1 },

  mistakes: { padding: 16, gap: 8 },
  mistakesTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: font.weightHeading,
    marginBottom: 2,
  },
});
