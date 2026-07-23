// Accuracy trend sparkline (design: the Progress card's rising line over a soft accent wash,
// with a dot on the latest session). Drawn with Views only — no SVG dependency — so the line is
// a run of rotated segments and the wash is a column silhouette under it. The web fill fades
// vertically; RN has no gradient primitive here, so the wash is a single flat tint instead.
import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, withAlpha } from '../../theme/nocturne';

export interface TrendLineProps {
  /** One value per session, 0–1, where 1 is the top of the plot. */
  values: number[];
  height: number;
  strokeWidth?: number;
  style?: ViewStyle;
}

const COLUMN_WIDTH = 4;

export function TrendLine({ values, height, strokeWidth = 2.5, style }: TrendLineProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const ready = width > 0 && values.length > 1;
  const pad = strokeWidth * 2; // keeps the stroke and the end dot inside the box
  const plot = height - pad * 2;
  const step = ready ? width / (values.length - 1) : 0;
  const yAt = (v: number) => pad + (1 - Math.max(0, Math.min(1, v))) * plot;

  // Interpolated y at an arbitrary x, for the wash columns between samples.
  const yAtX = (x: number) => {
    const t = x / step;
    const i = Math.min(values.length - 2, Math.floor(t));
    const f = t - i;
    return yAt(values[i] + (values[i + 1] - values[i]) * f);
  };

  const columns = ready ? Math.ceil(width / COLUMN_WIDTH) : 0;
  const lastX = width;
  const lastY = ready ? yAt(values[values.length - 1]) : 0;

  return (
    <View onLayout={onLayout} style={[{ height }, styles.box, style]}>
      {ready ? (
        <>
          {Array.from({ length: columns }, (_, i) => {
            const x = Math.min(i * COLUMN_WIDTH, width);
            const y = yAtX(x);
            return (
              <View
                key={`w${i}`}
                style={[
                  styles.wash,
                  { left: x, top: y, width: Math.min(COLUMN_WIDTH + 1, width - x), height: height - y },
                ]}
              />
            );
          })}

          {values.slice(0, -1).map((v, i) => {
            const x1 = i * step;
            const x2 = (i + 1) * step;
            const y1 = yAt(v);
            const y2 = yAt(values[i + 1]);
            const length = Math.hypot(x2 - x1, y2 - y1);
            const angle = `${Math.atan2(y2 - y1, x2 - x1)}rad`;
            return (
              <View
                key={`s${i}`}
                style={[
                  styles.segment,
                  {
                    width: length,
                    height: strokeWidth,
                    borderRadius: strokeWidth / 2,
                    left: (x1 + x2) / 2 - length / 2,
                    top: (y1 + y2) / 2 - strokeWidth / 2,
                    transform: [{ rotate: angle }],
                  },
                ]}
              />
            );
          })}

          <View
            style={[
              styles.endDot,
              { left: lastX - 4, top: lastY - 4 },
            ]}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%' },
  wash: { position: 'absolute', backgroundColor: withAlpha(colors.accent, 0.12) },
  segment: { position: 'absolute', backgroundColor: colors.accent },
  endDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
});
