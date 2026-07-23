// Nocturne tag/pill (styles.css .tag). Neutral variant used for the "Level N" chip.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../../theme/nocturne';

export function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    backgroundColor: colors.neutral[800],
    borderRadius: radius.md * 0.75,
    paddingVertical: 3,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  text: {
    color: colors.neutral[100],
    fontSize: 11,
    letterSpacing: 0.2,
  },
});
