// Small accent eyebrow label used above screen titles (design: uppercase, tracked, accent).
import React from 'react';
import { StyleSheet, Text, TextStyle } from 'react-native';
import { colors, font } from '../../theme/nocturne';

export function Kicker({ children, style }: { children: string; style?: TextStyle }) {
  return <Text style={[styles.kicker, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  kicker: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: font.weightSemibold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
