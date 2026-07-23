// Verdict banner (T031, FR-006): overall correct/incorrect + low-confidence/timeout messaging.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AttemptGrade } from '../../models';

export function VerdictBanner({ grade }: { grade: AttemptGrade }) {
  const { message, color } = describe(grade);
  return (
    <View accessibilityLiveRegion="polite" style={[styles.banner, { backgroundColor: color }]}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

function describe(grade: AttemptGrade): { message: string; color: string } {
  if (grade.timedOut) {
    return { message: 'No notes detected — replay or retry.', color: '#5C5F66' };
  }
  if (grade.lowConfidence) {
    return { message: 'Hard to hear that — let’s retry.', color: '#B08900' };
  }
  return grade.verdict === 'correct'
    ? { message: 'Correct! 🎉', color: '#2B8A3E' }
    : { message: 'Not quite — see the notes below.', color: '#C92A2A' };
}

const styles = StyleSheet.create({
  banner: { padding: 16, borderRadius: 12 },
  text: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
});
