// Home's strings (spec 023): six strings drawn as gentle waves that never stop moving. A touch plucks the string
// under the finger (it swells and settles) and asks the screen to sound that open string; a finger dragged across
// strums them one after another. Drawn from plain Views (the app has no SVG): each string is a row of short
// segments, every one riding the same looping clock a little further along the sine, all on the native driver.
// A segment's height is its wave times its string's own amplitude, which a pluck raises and lets fall.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { STRING_ROWS, stringAtY, waveKeyframes } from '../../lib/openStrings';
import { useReduceMotion } from '../common/Waveform';
import { colors } from '../../theme/nocturne';

const KEYFRAMES = 12;
const PERIOD_MS = 4200;
/** The wave's height in dp at amplitude 1. */
const UNIT = 5;
/** Segments are this far apart and a little longer, so the wave reads as a line. */
const SEG = 18;
/** How far along the wave each row starts (in segments), so the strings do not move in step. */
const ROW_SHIFT = 5;
/** Resting amplitude per row, top to bottom: the thin strings sway most. */
const IDLE = [1, 0.9, 0.8, 0.7, 0.6, 0.5];
/** Line thickness per row, top to bottom: thin high e to thick low E. */
const THICK = [1, 1.25, 1.5, 2, 2.5, 3];
/** A pluck raises the amplitude to this many times its resting value. */
const PLUCK_GAIN = 3.2;

export function StringsHero({ onPluck }: { onPluck: (row: number) => void }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const still = useReduceMotion();
  const clock = useRef(new Animated.Value(0)).current;
  const amp = useRef(IDLE.map((a) => new Animated.Value(a))).current;
  const pulse = useRef({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    t: new Animated.Value(0),
  }).current;
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

  const count = Math.max(0, Math.ceil(size.width / SEG));
  // One travelling wave shared by every string: segment k of a string reads wave (k + its shift) mod count.
  // Each segment is also tilted to follow the wave, so the line is smooth and not a staircase: the slope of the
  // sine, in radians at amplitude 1 (a small angle, so the slope is the angle).
  const waves = useMemo(() => {
    const inputRange = Array.from({ length: KEYFRAMES + 1 }, (_, j) => j / KEYFRAMES);
    const slope = (UNIT * 2 * Math.PI) / Math.max(1, count * SEG);
    return Array.from({ length: count }, (_, k) => ({
      lift: clock.interpolate({
        inputRange,
        outputRange: waveKeyframes(k / count, KEYFRAMES).map((v) => v * UNIT),
      }),
      tilt: clock.interpolate({
        inputRange,
        outputRange: waveKeyframes(k / count + 0.25, KEYFRAMES).map((v) => v * slope),
      }),
    }));
  }, [clock, count]);

  useEffect(() => () => amp.forEach((a) => a.stopAnimation()), [amp]);

  const touch = useCallback(
    (x: number, y: number, force: boolean) => {
      const row = stringAtY(y, size.height);
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
          duration: 1500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      pulse.x.setValue(x);
      pulse.y.setValue(((row + 0.5) * size.height) / STRING_ROWS);
      pulse.t.setValue(0);
      Animated.timing(pulse.t, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
      onPluck(row);
    },
    [amp, onPluck, pulse, size.height],
  );

  // Children ignore touches, so the event target is always this view and `locationY` is its own.
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => touch(e.nativeEvent.locationX, e.nativeEvent.locationY, true),
        onPanResponderMove: (e) => touch(e.nativeEvent.locationX, e.nativeEvent.locationY, false),
        onPanResponderRelease: () => {
          lastRow.current = -1;
        },
        onPanResponderTerminate: () => {
          lastRow.current = -1;
        },
      }),
    [touch],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
  };

  const rowH = size.height / STRING_ROWS;
  return (
    <View
      style={styles.area}
      onLayout={onLayout}
      accessible
      accessibilityLabel="Open guitar strings. Touch a string to hear it."
      {...responder.panHandlers}
    >
      {count > 0
        ? Array.from({ length: STRING_ROWS }, (_, row) => (
            <View
              key={row}
              pointerEvents="none"
              style={[styles.string, { top: rowH * (row + 0.5) - THICK[row] / 2 }]}
            >
              {Array.from({ length: count }, (_, k) => {
                const wave = waves[(k + row * ROW_SHIFT) % count];
                return (
                  <Animated.View
                    key={k}
                    style={[
                      styles.segment,
                      {
                        left: k * SEG - SEG * 0.125,
                        width: SEG * 1.25,
                        height: THICK[row],
                        borderRadius: THICK[row] / 2,
                        transform: [
                          { translateY: Animated.multiply(wave.lift, amp[row]) },
                          {
                            rotate: Animated.multiply(wave.tilt, amp[row]).interpolate({
                              inputRange: [-1, 1],
                              outputRange: ['-1rad', '1rad'],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                );
              })}
            </View>
          ))
        : null}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pulse,
          {
            opacity: pulse.t.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
            transform: [
              { translateX: Animated.subtract(pulse.x, 14) },
              { translateY: Animated.subtract(pulse.y, 14) },
              { scale: pulse.t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.8] }) },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Full-bleed (the screen pads its sides by 24) and as tall as the free room.
  area: { flex: 1, minHeight: 168, marginHorizontal: -24, overflow: 'hidden' },
  string: { position: 'absolute', left: 0, right: 0 },
  // Solid, not translucent: where segments overlap a translucent line would show dashes.
  segment: { position: 'absolute', top: 0, backgroundColor: colors.neutral[600] },
  pulse: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
  },
});
