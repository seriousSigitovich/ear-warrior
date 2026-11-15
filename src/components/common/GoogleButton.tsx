// "Continue with Google" (spec 022 FR-015): a white button with Google's four-colour "G" and Google's wording, so
// it reads as Google's and not as one of our outlined actions. The mark is a PNG (assets/app/google-g.svg is its
// source): the binary has no SVG module, and adding one would need a new store build instead of an OTA.
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius } from '../../theme/nocturne';

const LABEL = 'Continue with Google';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MARK = require('../../../assets/app/google-g.png');

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
        <Image source={MARK} style={styles.markImage} accessible={false} />
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
  mark: { width: 22, height: 22 },
  markImage: { width: 22, height: 22 },
  label: { color: '#1F1F1F', fontSize: 16, fontWeight: '600' },
});
