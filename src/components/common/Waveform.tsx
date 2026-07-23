// Waveform motif — the app's core sense (hearing) rendered as bars, per the redesign.
// Static mode paints fixed-height bars (Home hero, idle Practice); animated mode pulses
// accent bars with a staggered scaleY loop, mirroring the web @keyframes ewBar.
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../../theme/nocturne';

export interface WaveBar {
  /** Bar height as a fraction (0–1) of the container height. */
  heightPct: number;
  color: string;
}

interface WaveformProps {
  bars: WaveBar[];
  height: number;
  barWidth?: number;
  gap?: number;
  /** Vertical anchor: static bars sit on the baseline, animated bars pulse from center. */
  align?: 'flex-end' | 'center';
  animated?: boolean;
  style?: ViewStyle;
}

export function Waveform({
  bars,
  height,
  barWidth = 5,
  gap = 4,
  align = 'flex-end',
  animated = false,
  style,
}: WaveformProps) {
  return (
    <View style={[styles.row, { height, gap, alignItems: align }, style]}>
      {bars.map((b, i) =>
        animated ? (
          <AnimatedBar
            key={i}
            height={height}
            barWidth={barWidth}
            color={b.color}
            delay={i * 120}
          />
        ) : (
          <View
            key={i}
            style={{
              width: barWidth,
              height: Math.max(2, height * b.heightPct),
              borderRadius: 2,
              backgroundColor: b.color,
            }}
          />
        ),
      )}
    </View>
  );
}

// One pulsing bar: scaleY oscillates 0.35 → 1 → 0.35 over 900ms, offset by `delay`.
function AnimatedBar({
  height,
  barWidth,
  color,
  delay,
}: {
  height: number;
  barWidth: number;
  color: string;
  delay: number;
}) {
  const scale = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1, duration: 450, delay, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.35, duration: 450, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale, delay]);

  return (
    <Animated.View
      style={{
        width: barWidth,
        height: height * 0.6,
        borderRadius: 2,
        backgroundColor: color,
        transform: [{ scaleY: scale }],
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});

// ── Preset bar sets matching the redesign frames ───────────────────────────

/** Home hero: mixed neutral + accent bars. */
export const HERO_BARS: WaveBar[] = [
  { heightPct: 0.34, color: colors.neutral[700] },
  { heightPct: 0.58, color: colors.neutral[700] },
  { heightPct: 0.42, color: colors.accentRamp[600] },
  { heightPct: 0.8, color: colors.accent },
  { heightPct: 0.5, color: colors.neutral[700] },
  { heightPct: 0.66, color: colors.neutral[600] },
  { heightPct: 0.36, color: colors.neutral[700] },
  { heightPct: 0.7, color: colors.accentRamp[600] },
  { heightPct: 0.3, color: colors.neutral[700] },
  { heightPct: 0.56, color: colors.neutral[700] },
  { heightPct: 0.74, color: colors.accent },
  { heightPct: 0.44, color: colors.neutral[700] },
];

/** Idle Practice: quiet, all-neutral resting bars. */
export const IDLE_BARS: WaveBar[] = [0.4, 0.55, 0.35, 0.6, 0.42, 0.5, 0.38].map((heightPct) => ({
  heightPct,
  color: colors.neutral[800],
}));

/** Listening: uniform accent bars, animated. */
export const LISTENING_BARS: WaveBar[] = Array.from({ length: 7 }, () => ({
  heightPct: 0.6,
  color: colors.accent,
}));
