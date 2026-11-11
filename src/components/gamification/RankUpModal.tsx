// The celebration when a rank is gained: a card that springs in over the screen, with the new rank's name
// and one way out. Under reduced motion it simply appears. Shown once per rank-up by the screen that
// received it from the service.
import React, { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, View } from 'react-native';
import { Button } from '../common/Button';
import { useReduceMotion } from '../common/Waveform';
import { colors, font, radius, textAlpha, withAlpha } from '../../theme/nocturne';

export function RankUpModal({ rank, onClose }: { rank: string | null; onClose: () => void }) {
  const still = useReduceMotion();
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!rank) return;
    if (still) {
      pop.setValue(1);
      return;
    }
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }).start();
  }, [rank, still, pop]);

  return (
    <Modal visible={rank !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: pop,
              transform: [
                { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
              ],
            },
          ]}
          accessible
          accessibilityViewIsModal
          accessibilityLabel={`New rank: ${rank}`}
        >
          <Text style={styles.star} accessibilityElementsHidden importantForAccessibility="no">
            ✦
          </Text>
          <Text style={styles.kicker}>New rank</Text>
          <Text style={styles.name}>{rank}</Text>
          <Text style={styles.line}>Your ear is getting sharper.</Text>
          <Button label="Continue" variant="filled" onPress={onClose} style={styles.button} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: withAlpha(colors.bg, 0.82),
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accentRamp[700],
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  star: { color: colors.accent, fontSize: 40, lineHeight: 48 },
  kicker: { color: colors.accent, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase' },
  name: { color: colors.text, fontSize: 32, fontWeight: font.weightHeading },
  line: { color: textAlpha[65], fontSize: 14, marginBottom: 12 },
  button: { alignSelf: 'stretch' },
});
