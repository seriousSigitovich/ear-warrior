// Nocturne card surface (styles.css .card): surface fill, md radius, optional hairline elevation.
import React from 'react';
import { StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { colors, radius, space } from '../../theme/nocturne';

/** Accepts the underlying View's props (accessibility, testID, …) so callers need not wrap it. */
export type CardProps = Omit<ViewProps, 'style'> & {
  children: React.ReactNode;
  elevated?: boolean;
  style?: ViewStyle | ViewStyle[];
};

export function Card({ children, elevated, style, ...rest }: CardProps) {
  return (
    <View style={[styles.card, elevated && styles.elev, style]} {...rest}>
      {children}
    </View>
  );
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
