// "Continue with Google" (spec 022 FR-015): a white button with the "G" mark and Google's wording, so it reads
// as Google's and not as one of our outlined actions. The mark is drawn from four coloured quarters of a ring
// plus the bar, using plain Views (no SVG module in the binary; adding one would need a new store build).
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius } from '../../theme/nocturne';

const LABEL = 'Continue with Google';

export interface GoogleButtonProps {
  onPress: () => void;
  /** Replaces the label while working ("Opening Google…"); the accessible name stays stable. */
  busyLabel?: string;
  disabled?: boolean;
}

export function GoogleButton({ onPress, busyLabel, disabled }: GoogleButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={LABEL}
      accessibilityState={{ disabled: !!disabled, busy: !!busyLabel }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.base, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <View style={styles.mark} importantForAccessibility="no-hide-descendants">
        <Text style={styles.g}>G</Text>
      </View>
      <Text style={styles.label}>{busyLabel ?? LABEL}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    paddingHorizontal: 16,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
  mark: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  // The official four-colour G is an image asset; until it is added, a Google-blue G keeps the button recognisable.
  g: { color: '#4285F4', fontSize: 20, fontWeight: '700', lineHeight: 24 },
  label: { color: '#1F1F1F', fontSize: 16, fontWeight: '600' },
});
