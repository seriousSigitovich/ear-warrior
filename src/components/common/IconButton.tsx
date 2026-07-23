// Square icon action (design: the 52×52 outlined replay button beside the primary transport
// action). Same Nocturne outline treatment as <Button/>, but sized for a glyph and always
// labelled for screen readers, since it carries no visible text.
import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, withAlpha } from '../../theme/nocturne';

export function IconButton({
  accessibilityLabel,
  onPress,
  disabled,
  children,
  style,
}: {
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        pressed && styles.pressed,
        disabled && styles.dim,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

/** Circular replay arrow, drawn with Views (no SVG): a broken ring plus an arrowhead. */
export function ReplayIcon({ color = colors.text }: { color?: string }) {
  return (
    <View style={styles.icon}>
      <View style={[styles.ring, { borderColor: color, borderTopColor: 'transparent' }]} />
      <View style={[styles.head, { borderBottomColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: withAlpha(colors.text, 0.1) },
  dim: { opacity: 0.45 },

  icon: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  ring: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.6,
    transform: [{ rotate: '-35deg' }],
  },
  // The arrowhead closing the ring's open top-right end.
  head: {
    position: 'absolute',
    top: 0,
    right: 1,
    width: 0,
    height: 0,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderBottomWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '135deg' }],
  },
});
