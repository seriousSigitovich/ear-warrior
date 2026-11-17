// A short, calm line about something the learner can fix by getting online (spec 024): a melody's clip that has not been
// downloaded yet, an answer waiting to be checked, a hint that needs the server. Spoken as an alert, so it is not missed.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, textAlpha, withAlpha } from '../../theme/nocturne';

export function StatusNotice({ text }: { text: string }) {
  return (
    <View style={styles.box} accessible accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

/** What the loop's flags say, in words (one at a time, the most pressing first); null when all is well. */
export function noticeFor(s: {
  audioUnavailable: boolean;
  waiting: boolean;
  helpUnavailable: boolean;
  checkFailed: boolean;
}): string | null {
  if (s.audioUnavailable)
    return 'This melody has not been downloaded yet. Connect to the internet and tap play.';
  if (s.waiting) return 'No connection. Your answer will be checked as soon as you are online.';
  if (s.helpUnavailable) return 'Hints need a connection. Try again when you are online.';
  if (s.checkFailed) return 'This melody changed and cannot be checked. Try the next one.';
  return null;
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: withAlpha(colors.accent, 0.12),
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  text: { color: textAlpha[70], fontSize: 13, lineHeight: 18 },
});
