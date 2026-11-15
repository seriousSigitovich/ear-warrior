// A thin progress bar whose fill eases to a new value instead of jumping (and fills once from empty when it
// first shows). Under reduced motion it is simply drawn at the value. JS-driven: a width cannot use the native driver.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../../theme/nocturne';
import { useReduceMotion } from './Waveform';

const EASE_MS = 600;

export function AnimatedBar({
  pct,
  height = 4,
  color = colors.accent,
  style,
}: {
  /** 0–100. */
  pct: number;
  height?: number;
  color?: string;
  style?: ViewStyle;
}) {
  const target = Math.max(0, Math.min(100, pct));
  const still = useReduceMotion();
  const value = useRef(new Animated.Value(still ? target : 0)).current;
  useEffect(() => {
    if (still) {
      value.setValue(target);
      return;
    }
    const run = Animated.timing(value, {
      toValue: target,
      duration: EASE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    run.start();
    return () => run.stop();
  }, [target, still, value]);

  const r = height / 2;
  return (
    <View
      style={[styles.track, { height, borderRadius: r }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Animated.View
        style={{
          height,
          borderRadius: r,
          backgroundColor: color,
          width: value.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: colors.divider, overflow: 'hidden' },
});
