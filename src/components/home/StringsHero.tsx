// Home's neck (spec 023): a stretch of guitar neck with a nut, fret wires to scale and inlays, and the six strings
// pinned at the nut and the far edge, so each swings in one arc like a real string. They move without end, a little
// out of step; a touch plucks the string under the finger (it swells and settles) and asks the screen to sound that
// open string; a drag strums. The notes of the phrase the learner answered last are lit along it.
// Drawn from plain Views (the app has no SVG): each string is a row of short segments riding one looping clock,
// tilted to the string's slope so the line is smooth, all on the native driver.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FretPosition, STRING_COUNT } from '../../lib/fretboard';
import { fretCentre, fretEdges, standingWave } from '../../lib/neckNotes';
import { STRING_ROWS, stringAtY, waveKeyframes } from '../../lib/openStrings';
import { useReduceMotion } from '../common/Waveform';
import { colors, withAlpha } from '../../theme/nocturne';

const KEYFRAMES = 12;
const PERIOD_MS = 3600;
/** How far a string swings at rest, in dp at its middle. */
const UNIT = 4;
const SEG = 16;
/** Resting swing per row, top to bottom: the thin strings sway most. */
const IDLE = [1, 0.9, 0.8, 0.7, 0.6, 0.5];
/** Line thickness per row: thin high e to thick low E. */
const THICK = [1, 1.3, 1.7, 2.2, 2.7, 3.2];
/** Plain (nylon-like) strings are light; the wound ones are the palette's warm tone. */
const WOUND_FROM_ROW = 3;
/** A pluck raises the swing to this many times its resting value. */
const PLUCK_GAIN = 3.4;
/** Where the nut stands, from the area's left edge (the screen pads its sides by 24 and the area bleeds past it). */
const NUT_X = 40;
const NUT_W = 7;
const LABEL_H = 22;
/** The neck is not stretched past this height on a tall phone: it stays centred in the free room. */
const MAX_NECK = 290;
const DOT = 14;
const INLAYS = [3, 5, 7, 9];
const NUMBERS = [1, 3, 5, 7, 9, 12];

export function StringsHero({
  onPluck,
  notes = [],
}: {
  onPluck: (row: number) => void;
  /** Positions of the notes to light, in the order they were played. */
  notes?: readonly FretPosition[];
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const still = useReduceMotion();
  const clock = useRef(new Animated.Value(0)).current;
  const amp = useRef(IDLE.map((a) => new Animated.Value(a))).current;
  const lastRow = useRef(-1);

  // The clock runs only while Home is on screen (it stays mounted under Practice) and motion is allowed.
  useFocusEffect(
    useCallback(() => {
      if (still) return;
      clock.setValue(0);
      const loop = Animated.loop(
        Animated.timing(clock, {
          toValue: 1,
          duration: PERIOD_MS,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    }, [clock, still]),
  );

  const neckLength = Math.max(0, size.width - NUT_X);
  const neckHeight = Math.max(0, Math.min(MAX_NECK, size.height - LABEL_H));
  const offsetY = Math.max(0, (size.height - neckHeight - LABEL_H) / 2);
  const rowH = neckHeight / STRING_ROWS;
  const edges = useMemo(() => fretEdges(neckLength), [neckLength]);
  const count = Math.ceil(neckLength / SEG);

  // Each string swings as cos(clock) over the arc of a string pinned at both ends; rows start at different phases.
  const drive = useMemo(
    () =>
      IDLE.map((_, row) =>
        Animated.multiply(
          clock.interpolate({
            inputRange: Array.from({ length: KEYFRAMES + 1 }, (_, j) => j / KEYFRAMES),
            outputRange: waveKeyframes(0.25 + row * 0.19, KEYFRAMES),
          }),
          amp[row],
        ),
      ),
    [clock, amp],
  );
  // Per segment, the string's arc and slope there (the same for every string).
  const arc = useMemo(
    () =>
      Array.from({ length: count }, (_, k) => {
        const w = standingWave((k + 0.5) * SEG, neckLength);
        return { lift: w.lift * UNIT, tilt: w.slope * UNIT };
      }),
    [count, neckLength],
  );

  useEffect(() => () => amp.forEach((a) => a.stopAnimation()), [amp]);

  const touch = useCallback(
    (y: number, force: boolean) => {
      const row = stringAtY(y, neckHeight);
      if (!force && row === lastRow.current) return;
      lastRow.current = row;
      Animated.sequence([
        Animated.timing(amp[row], {
          toValue: IDLE[row] * PLUCK_GAIN,
          duration: 70,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(amp[row], {
          toValue: IDLE[row],
          duration: 1600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      onPluck(row);
    },
    [amp, neckHeight, onPluck],
  );

  // Children ignore touches, so the event target is always this view and `locationY` is its own.
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => touch(e.nativeEvent.locationY - offsetY, true),
        onPanResponderMove: (e) => touch(e.nativeEvent.locationY - offsetY, false),
        onPanResponderRelease: () => {
          lastRow.current = -1;
        },
        onPanResponderTerminate: () => {
          lastRow.current = -1;
        },
      }),
    [touch, offsetY],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
  };

  // A note's centre on the neck; string 0 is the low E, which is the bottom row.
  const dotAt = (p: FretPosition) => ({
    x: p.fret === 0 ? NUT_X - 16 : NUT_X + fretCentre(p.fret, edges),
    y: rowH * (STRING_COUNT - 1 - p.string + 0.5),
  });
  const dots = notes.map(dotAt);

  return (
    <View
      style={styles.area}
      onLayout={onLayout}
      accessible
      accessibilityLabel="Open guitar strings. Touch a string to hear it."
      {...responder.panHandlers}
    >
      {neckLength > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: offsetY,
            height: neckHeight + LABEL_H,
          }}
        >
          <View style={[styles.board, { left: NUT_X, height: neckHeight }]} />
          {edges.slice(1).map((x, i) => (
            <View key={i} style={[styles.fret, { left: NUT_X + x - 1, height: neckHeight }]} />
          ))}
          <View style={[styles.nut, { left: NUT_X - NUT_W, height: neckHeight }]} />
          {INLAYS.map((n) => (
            <View
              key={n}
              style={[
                styles.inlay,
                { left: NUT_X + fretCentre(n, edges) - 6, top: neckHeight / 2 - 6 },
              ]}
            />
          ))}
          {NUMBERS.map((n) => (
            <Text
              key={n}
              style={[
                styles.number,
                { left: NUT_X + fretCentre(n, edges) - 10, top: neckHeight + 4 },
              ]}
            >
              {n}
            </Text>
          ))}
          {Array.from({ length: STRING_ROWS }, (_, row) => (
            <View
              key={row}
              style={[styles.string, { top: rowH * (row + 0.5) - THICK[row] / 2, left: NUT_X }]}
            >
              {Array.from({ length: count }, (_, k) => (
                <Animated.View
                  key={k}
                  style={{
                    position: 'absolute',
                    left: k * SEG - 1,
                    width: SEG + 2,
                    height: THICK[row],
                    borderRadius: THICK[row] / 2,
                    backgroundColor: row >= WOUND_FROM_ROW ? colors.warm : colors.neutral[400],
                    transform: [
                      { translateY: Animated.multiply(drive[row], arc[k].lift) },
                      {
                        rotate: Animated.multiply(drive[row], arc[k].tilt).interpolate({
                          inputRange: [-1, 1],
                          outputRange: ['-1rad', '1rad'],
                        }),
                      },
                    ],
                  }}
                />
              ))}
            </View>
          ))}
          {dots.slice(1).map((d, i) => {
            const a = dots[i];
            const len = Math.hypot(d.x - a.x, d.y - a.y);
            return (
              <View
                key={`l${i}`}
                style={[
                  styles.link,
                  {
                    left: (a.x + d.x) / 2 - len / 2,
                    top: (a.y + d.y) / 2 - 0.75,
                    width: len,
                    transform: [{ rotate: `${Math.atan2(d.y - a.y, d.x - a.x)}rad` }],
                  },
                ]}
              />
            );
          })}
          {dots.map((d, i) => (
            <View
              key={`d${i}`}
              style={[
                styles.dot,
                i === dots.length - 1 && styles.dotLast,
                { left: d.x - DOT / 2, top: d.y - DOT / 2 },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Full-bleed (the screen pads its sides by 24) and as tall as the free room.
  area: { flex: 1, minHeight: 190, marginHorizontal: -24, overflow: 'hidden' },
  board: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: withAlpha(colors.surface, 0.55),
  },
  fret: { position: 'absolute', top: 0, width: 2, backgroundColor: withAlpha(colors.text, 0.14) },
  nut: {
    position: 'absolute',
    top: 0,
    width: NUT_W,
    backgroundColor: withAlpha(colors.neutral[300], 0.75),
  },
  inlay: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: withAlpha(colors.text, 0.08),
  },
  number: {
    position: 'absolute',
    width: 20,
    textAlign: 'center',
    fontSize: 11,
    color: withAlpha(colors.text, 0.4),
  },
  string: { position: 'absolute', right: 0 },
  link: { position: 'absolute', height: 1.5, backgroundColor: withAlpha(colors.accent, 0.4) },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.accent,
  },
  dotLast: { backgroundColor: colors.accentRamp[300] },
});
