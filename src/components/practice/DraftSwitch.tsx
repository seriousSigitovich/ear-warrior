// The Draft on/off pill (spec 008), shown in the navigation bar while answering (spec 016). The state is in
// its text too ("Draft · On"), not only its colour, and toggling it is announced to screen readers.
import React from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text } from 'react-native';
import { draftToggleAnnouncement } from '../../lib/fretboardA11y';
import { colors, radius } from '../../theme/nocturne';

export function DraftSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel="Draft mode"
      accessibilityState={{ checked: on }}
      onPress={() => {
        AccessibilityInfo.announceForAccessibility(draftToggleAnnouncement(!on));
        onToggle();
      }}
      hitSlop={8}
      style={({ pressed }) => [styles.pill, on && styles.on, pressed && styles.pressed]}
    >
      <Text style={[styles.text, on && styles.textOn]}>{on ? 'Draft · On' : 'Draft'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 36,
    minWidth: 64,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  on: { backgroundColor: colors.accent, borderColor: colors.accent },
  pressed: { opacity: 0.7 },
  text: { color: colors.text, fontSize: 13, fontWeight: '600' },
  textOn: { color: colors.bg },
});
