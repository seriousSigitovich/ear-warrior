// A kind of melodic move drawn as four notes: two on one level, then the move, then one more where it
// landed. The move itself (its line and the note it lands on) takes the warm colour — this drawing is
// only ever shown for the learner's weak spot. Views only: a line is a thin rotated View.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../theme/nocturne';

const WIDTH = 64;
const HEIGHT = 44;
const DOT = 8;
const LINE = 2;
/** Vertical distance per unit of rise; ±4 spans the height less the dots. */
const UNIT = (HEIGHT - DOT - 4) / 8;
const XS = [6, 22, 42, 58];

function Segment({
  from,
  to,
  color,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  return (
    <View
      style={[
        styles.segment,
        {
          width: length,
          left: (from.x + to.x) / 2 - length / 2,
          top: (from.y + to.y) / 2 - LINE / 2,
          backgroundColor: color,
          transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
        },
      ]}
    />
  );
}

/** `rise`: how far the move goes, −4…4, up positive (see `intervalRise`). */
export function MoveShape({ rise }: { rise: number }) {
  const start = HEIGHT / 2 + rise * UNIT;
  const end = HEIGHT / 2 - rise * UNIT;
  const points = XS.map((x, i) => ({ x, y: i < 2 ? start : end }));
  return (
    <View style={styles.box} accessibilityElementsHidden importantForAccessibility="no">
      <Segment from={points[0]} to={points[1]} color={colors.accentRamp[700]} />
      <Segment from={points[1]} to={points[2]} color={colors.warm} />
      <Segment from={points[2]} to={points[3]} color={colors.accentRamp[700]} />
      {points.map((p, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { left: p.x - DOT / 2, top: p.y - DOT / 2 },
            i === 2 && styles.landing,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: WIDTH, height: HEIGHT },
  segment: { position: 'absolute', height: LINE, borderRadius: LINE / 2 },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.accent,
  },
  landing: { backgroundColor: colors.warm },
});
