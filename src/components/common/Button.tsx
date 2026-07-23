// Shared accessible button (Constitution III: single source of shared UX, labeled controls).
// Nocturne styling: outlined actions rather than filled — primary carries the accent as a
// line (and optional glow), secondary a quiet divider border, ghost a bare accent link.
import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';
import { colors, radius, withAlpha } from '../../theme/nocturne';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Adds the accent glow used on the hero "Start practice" call to action. */
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, disabled, variant = 'primary', glow, style }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        glow && styles.glow,
        pressed && (variant === 'secondary' ? styles.pressedSecondary : styles.pressedAccent),
        disabled && styles.dim,
        style,
      ]}
    >
      <Text style={[styles.label, variant === 'secondary' ? styles.labelNeutral : styles.labelAccent]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primary: { borderColor: colors.accent },
  secondary: { borderColor: colors.divider },
  ghost: { borderColor: 'transparent', minHeight: 0, paddingVertical: 4, paddingHorizontal: 6 },
  glow: {
    // stands in for the web box-shadow accent bloom
    shadowColor: colors.accent,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  pressedAccent: { backgroundColor: withAlpha(colors.accent, 0.18) },
  pressedSecondary: { backgroundColor: withAlpha(colors.text, 0.1) },
  dim: { opacity: 0.45 },
  label: { fontSize: 15, fontWeight: '500' },
  labelAccent: { color: colors.accent },
  labelNeutral: { color: colors.text } as TextStyle,
});
