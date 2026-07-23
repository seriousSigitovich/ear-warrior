// Retry state (FR-015/FR-017): shown when the attempt was too unclear to grade (low
// confidence) or nothing was captured (timeout). A centered mic motif with a calm message
// and Replay / Retry actions — no scoring, just "let's try again".
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, textAlpha } from '../../theme/nocturne';

export function RetryState({ timedOut }: { timedOut: boolean }) {
  return (
    <View style={styles.wrap}>
      <MicIcon />
      <Text style={styles.title}>{timedOut ? 'No notes detected' : 'Hard to hear that'}</Text>
      <Text style={styles.body}>
        {timedOut
          ? "We didn't pick up any playing this time — replay the melody or try again."
          : 'Overlapping strings or background noise made this one unclear — let’s try again.'}
      </Text>
    </View>
  );
}

// Simple microphone drawn with Views (no SVG): capsule body, cup, and stand.
function MicIcon() {
  return (
    <View style={styles.mic}>
      <View style={styles.micBody} />
      <View style={styles.micCup} />
      <View style={styles.micStem} />
    </View>
  );
}

const STROKE = colors.neutral[500];

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { color: colors.text, fontSize: 17, fontWeight: font.weightHeading, textAlign: 'center' },
  body: { color: textAlpha[60], fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 230 },
  mic: { width: 26, height: 32, alignItems: 'center' },
  micBody: {
    width: 12,
    height: 16,
    borderRadius: 6,
    borderWidth: 1.6,
    borderColor: STROKE,
  },
  micCup: {
    position: 'absolute',
    top: 10,
    width: 22,
    height: 11,
    borderWidth: 1.6,
    borderTopWidth: 0,
    borderColor: STROKE,
    borderBottomLeftRadius: 11,
    borderBottomRightRadius: 11,
    backgroundColor: 'transparent',
  },
  micStem: { position: 'absolute', bottom: 0, width: 1.6, height: 5, backgroundColor: STROKE },
});
