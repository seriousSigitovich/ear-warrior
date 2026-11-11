// A progress ring drawn with Views only (no SVG dependency): a track circle, and the filled arc as two
// half rings, each turned into view behind a half-width clip — the right half shows the first 50%, the
// left half the rest. It fills once on mount, and is simply drawn filled under reduced motion.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../../theme/nocturne';
import { useReduceMotion } from './Waveform';

export interface RingProps {
  size: number;
  stroke: number;
  /** 0–1. */
  progress: number;
  color?: string;
  track?: string;
  /** Centred inside the ring. */
  children?: React.ReactNode;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

const FILL_MS = 700;

export function Ring({
  size,
  stroke,
  progress,
  color = colors.accent,
  track = colors.neutral[800],
  children,
  accessibilityLabel,
  style,
}: RingProps) {
  const target = Math.max(0, Math.min(1, progress));
  const still = useReduceMotion();
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (still) {
      value.setValue(target);
      return;
    }
    const fill = Animated.timing(value, {
      toValue: target,
      duration: FILL_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    fill.start();
    return () => fill.stop();
  }, [value, target, still]);

  const half = size / 2;
  const circle = { width: size, height: size, borderRadius: half, borderWidth: stroke };
  const firstHalf = value.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '180deg', '180deg'],
  });
  const secondHalf = value.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '0deg', '180deg'],
  });

  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'progressbar' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.abs, circle, { borderColor: track }]} />

      <View style={[styles.clip, { left: half, width: half, height: size }]}>
        <Animated.View
          style={[
            styles.abs,
            { left: -half, width: size, height: size, transform: [{ rotate: firstHalf }] },
          ]}
        >
          <View style={[styles.clip, { left: 0, width: half, height: size }]}>
            <View style={[circle, { borderColor: color }]} />
          </View>
        </Animated.View>
      </View>

      <View style={[styles.clip, { left: 0, width: half, height: size }]}>
        <Animated.View
          style={[
            styles.abs,
            { left: 0, width: size, height: size, transform: [{ rotate: secondHalf }] },
          ]}
        >
          <View style={[styles.clip, { left: half, width: half, height: size }]}>
            <View style={[styles.abs, circle, { left: -half, borderColor: color }]} />
          </View>
        </Animated.View>
      </View>

      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', top: 0 },
  clip: { position: 'absolute', top: 0, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
