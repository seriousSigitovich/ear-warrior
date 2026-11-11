// A small pulsing dot in the corner of a control that has something waiting behind it (spec 015): a soft
// ring spreads from it and fades, over and over. Under reduced motion it is a still dot. Decorative: the
// control's own accessibility label says what is waiting, so a screen reader skips the dot. The ring
// around the dot is the screen's background, so it stays readable over a card or an outlined button.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../../theme/nocturne';
import { useReduceMotion } from '../common/Waveform';

const SIZE = 12;
const PULSE_MS = 1600;

export function AttentionDot() {
  const still = useReduceMotion();
  const wave = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (still) {
      wave.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wave, {
          toValue: 1,
          duration: PULSE_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(400),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [still, wave]);

  return (
    <View
      style={styles.corner}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {still ? null : (
        <Animated.View
          style={[
            styles.halo,
            {
              opacity: wave.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
              transform: [
                { scale: wave.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) },
              ],
            },
          ]}
        />
      )}
      <View style={styles.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  corner: { position: 'absolute', top: -4, right: -4, width: SIZE, height: SIZE },
  halo: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.accent,
  },
  dot: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.bg,
  },
});
