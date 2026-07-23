// Tuning advisory (T030, FR-014): non-blocking nudge when the attempt reads consistently
// sharp/flat. A quiet outlined bar with a warning mark and a ghost "Tune" action that plays
// a standard-tuning reference tone. The learner may ignore it and keep going.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TuningDirection } from '../../models';
import { Button } from '../common/Button';
import { colors, radius, textAlpha } from '../../theme/nocturne';

export function TuningAdvisory({
  direction,
  onTune,
}: {
  direction: TuningDirection;
  onTune: () => void;
}) {
  return (
    <View style={styles.bar}>
      <AdvisoryIcon />
      <Text style={styles.text}>
        Reading a touch {direction === 'none' ? 'off' : direction} — worth a tune-up.
      </Text>
      <Button label="Tune" variant="ghost" onPress={onTune} />
    </View>
  );
}

// A small filled warning triangle with an exclamation, drawn with Views (no SVG).
function AdvisoryIcon() {
  return (
    <View style={styles.iconBox}>
      <View style={styles.triangle} />
      <Text style={styles.bang}>!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  text: { flex: 1, fontSize: 12, color: textAlpha[70] },
  iconBox: { width: 15, height: 15, alignItems: 'center', justifyContent: 'center' },
  triangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 13,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.neutral[500],
  },
  bang: {
    position: 'absolute',
    top: 4,
    color: colors.bg,
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
  },
});
