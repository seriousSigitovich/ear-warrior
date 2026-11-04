// First-run onboarding (beta checklist): three screens — listen, find it on the fretboard, hear the
// verdict. Shown once; Skip is always there. Finishing marks it seen and returns to Home.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../src/components/common/Screen';
import { Button } from '../src/components/common/Button';
import { Kicker } from '../src/components/common/Kicker';
import { Waveform, HERO_BARS } from '../src/components/common/Waveform';
import { ONBOARDING_STEPS, markOnboarded } from '../src/lib/onboarding';
import { heroScale, scaled } from '../src/lib/heroScale';
import { KEY_VALUE_TABLE, defaultRowStore } from '../src/services/storage/db';
import { keyValueOverRowStore } from '../src/lib/deviceId';
import { track } from '../src/features/analytics/tracker';
import { colors, font, textAlpha } from '../src/theme/nocturne';

export default function Onboarding() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const step = ONBOARDING_STEPS[index];
  const last = index === ONBOARDING_STEPS.length - 1;
  // The text block grows on tall phones instead of leaving most of the screen empty.
  const s = heroScale(useWindowDimensions().height);

  // Which onboarding screens were seen: a drop between steps shows where people give up.
  useEffect(() => track('onboarding_step', { step: index + 1 }), [index]);

  const finish = () => {
    void markOnboarded(keyValueOverRowStore(defaultRowStore(), KEY_VALUE_TABLE));
    track('onboarding_done', { step_reached: index + 1, skipped: !last });
    router.back();
  };

  return (
    <Screen style={styles.screen}>
      <Kicker style={{ fontSize: scaled(11, s) }}>{step.kicker}</Kicker>
      <Text
        accessibilityRole="header"
        style={[styles.title, { fontSize: scaled(28, s), lineHeight: scaled(34, s) }]}
      >
        {step.title}
      </Text>
      <Text style={[styles.body, { fontSize: scaled(15, s), lineHeight: scaled(23, s) }]}>
        {step.body}
      </Text>
      <Waveform
        bars={HERO_BARS}
        height={scaled(48, s)}
        barWidth={scaled(5, s)}
        gap={scaled(4, s)}
        breathe
        style={styles.wave}
      />

      <View style={styles.spacer} />

      <View
        accessible
        accessibilityLabel={`Step ${index + 1} of ${ONBOARDING_STEPS.length}`}
        style={styles.dots}
      >
        {ONBOARDING_STEPS.map((s, i) => (
          <View key={s.kicker} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <Button
        label={last ? 'Start practicing' : 'Next'}
        glow
        onPress={last ? finish : () => setIndex(index + 1)}
        style={styles.cta}
      />
      {last ? null : <Button label="Skip" variant="ghost" onPress={finish} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: 40 },
  title: {
    color: colors.text,
    fontWeight: font.weightHeading,
    marginTop: 8,
    marginBottom: 12,
  },
  body: { color: textAlpha[65] },
  wave: { marginTop: 28 },
  spacer: { flex: 1 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.divider },
  dotActive: { backgroundColor: colors.accent },
  cta: { minHeight: 52 },
});
