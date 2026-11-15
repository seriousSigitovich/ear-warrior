// Home's weekly activity (spec 023): the streak, the seven days of this week and the weekly goal as a bar. The days
// and the streak come from the same set of practice days, so they never disagree.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WeekDay, daysLabel } from '../../lib/streak';
import { AnimatedBar } from '../common/AnimatedBar';
import { Kicker } from '../common/Kicker';
import { Flame } from '../gamification/Flame';
import { WeekStrip } from '../progress/WeekStrip';
import { colors, font, radius, textAlpha } from '../../theme/nocturne';

export function WeeklyActivityCard({
  days,
  streakDays,
  practised,
  goal,
  challengesGoal,
  showChallengeCount,
}: {
  days: readonly WeekDay[];
  streakDays: number;
  /** Days practised this week so far. */
  practised: number;
  /** Days the learner is invited to practise a week. */
  goal: number;
  /** The daily challenges a day (today's ring counts them while they are shown). */
  challengesGoal: number;
  showChallengeCount: boolean;
}) {
  const met = practised >= goal;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Kicker style={styles.kicker}>Weekly activity</Kicker>
        <View
          style={styles.streak}
          accessible
          accessibilityLabel={`Streak: ${daysLabel(streakDays)} in a row`}
        >
          <Flame size={16} />
          <Text style={styles.streakText}>{daysLabel(streakDays)}</Text>
        </View>
      </View>
      <WeekStrip days={days} goal={challengesGoal} showCount={showChallengeCount} />
      <View
        style={styles.goal}
        accessible
        accessibilityLabel={`Weekly goal: ${practised} of ${goal} days${met ? ', reached' : ''}`}
      >
        <View style={styles.goalLine}>
          <Text style={styles.goalLabel}>Weekly goal</Text>
          <Text style={[styles.goalValue, met && styles.goalMet]}>
            {practised} / {goal} days
          </Text>
        </View>
        <AnimatedBar pct={(Math.min(practised, goal) / goal) * 100} height={5} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, gap: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { fontSize: 10 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  streakText: { color: colors.text, fontSize: 14, fontWeight: font.weightHeading },
  goal: { gap: 6 },
  goalLine: { flexDirection: 'row', justifyContent: 'space-between' },
  goalLabel: { color: textAlpha[55], fontSize: 12 },
  goalValue: { color: colors.text, fontSize: 12, fontWeight: font.weightHeading },
  goalMet: { color: colors.accentRamp[300] },
});
