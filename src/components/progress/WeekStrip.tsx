// The current week as seven day circles (spec 011): a practised day is filled, today fills up as the
// daily goal is met, a day not practised on is an empty outline, a day still to come a dashed one. A
// row with a gap in it is the nudge — the streak drawn rather than counted.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WeekDay } from '../../lib/streak';
import { Ring } from '../common/Ring';
import { colors, font } from '../../theme/nocturne';

const DAY = 30;

function dayLabel(d: WeekDay, goal: number): string {
  if (d.state === 'today') return `Today: ${d.count} of ${goal} melodies`;
  if (d.state === 'ahead') return 'still to come';
  return d.count > 0 ? 'practised' : 'no practice';
}

export function WeekStrip({ days, goal }: { days: readonly WeekDay[]; goal: number }) {
  return (
    <View style={styles.row}>
      {days.map((d, i) => {
        const done = d.state === 'done' || (d.state === 'today' && d.goalMet);
        return (
          <View
            key={i}
            style={styles.day}
            accessible
            accessibilityLabel={`${d.letter}: ${dayLabel(d, goal)}`}
          >
            {done ? (
              <View style={[styles.circle, styles.done]}>
                <Text style={styles.check}>✓</Text>
              </View>
            ) : d.state === 'today' ? (
              <Ring size={DAY} stroke={3} progress={d.count / goal}>
                <Text style={styles.count}>{d.count}</Text>
              </Ring>
            ) : (
              <View style={[styles.circle, styles.empty, d.state === 'ahead' && styles.ahead]} />
            )}
            <Text style={[styles.letter, d.state === 'today' && styles.letterToday]}>
              {d.letter}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 5 },
  circle: {
    width: DAY,
    height: DAY,
    borderRadius: DAY / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: { backgroundColor: colors.accent },
  check: { color: colors.bg, fontSize: 15, fontWeight: font.weightSemibold },
  empty: { borderWidth: 1.5, borderColor: colors.neutral[800] },
  ahead: { borderStyle: 'dashed' },
  count: { color: colors.text, fontSize: 12, fontWeight: font.weightHeading },
  letter: { color: colors.neutral[600], fontSize: 11 },
  letterToday: { color: colors.text },
});
