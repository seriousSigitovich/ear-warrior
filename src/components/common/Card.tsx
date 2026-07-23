// Nocturne card surface (styles.css .card): surface fill, md radius, optional hairline elevation.
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, space } from '../../theme/nocturne';

export function Card({
  children,
  elevated,
  style,
}: {
  children: React.ReactNode;
  elevated?: boolean;
  style?: ViewStyle | ViewStyle[];
}) {
  return <View style={[styles.card, elevated && styles.elev, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space[3],
    gap: space[2],
  },
  // .elev-sm — a hairline edge standing in for a shadow on the dark ground.
  elev: {
    borderWidth: 1,
    borderColor: colors.neutral[800],
  },
});
