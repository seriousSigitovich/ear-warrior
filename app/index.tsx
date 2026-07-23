// Home screen (T035): start a practice session and navigate into the core loop.
// Redesigned onto Nocturne — hero heading, waveform motif, quick stats, outlined actions.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MAX_RANK } from '../src/services/melody/levels';
import { DEFAULT_DIFFICULTY_SETTINGS, effectiveRank } from '../src/features/difficulty/adapt';
import { defaultRowStore } from '../src/services/storage/db';
import { createDifficultySettingsRepository } from '../src/services/storage/repositories';
import { Screen } from '../src/components/common/Screen';
import { Button } from '../src/components/common/Button';
import { Card } from '../src/components/common/Card';
import { Kicker } from '../src/components/common/Kicker';
import { Waveform, HERO_BARS } from '../src/components/common/Waveform';
import { colors, font, textAlpha } from '../src/theme/nocturne';

export default function Home() {
  const router = useRouter();
  const [rank, setRank] = useState(effectiveRank(DEFAULT_DIFFICULTY_SETTINGS));

  useEffect(() => {
    let cancelled = false;
    createDifficultySettingsRepository(defaultRowStore())
      .load()
      .then((s) => {
        if (!cancelled) setRank(effectiveRank(s));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Screen style={styles.screen}>
      <Kicker>Ear Warrior</Kicker>
      <Text style={styles.title}>Hear it.{'\n'}Play it back.{'\n'}Nail it.</Text>
      <Text style={styles.blurb}>
        A short melody plays. You reproduce it on guitar. We tell you exactly which notes landed.
      </Text>

      <Waveform bars={HERO_BARS} height={48} style={styles.wave} />

      <View style={styles.spacer} />

      <View style={styles.statRow}>
        <Card style={styles.stat}>
          <Text style={styles.statKicker}>Streak</Text>
          <Text style={styles.statValue}>6 days</Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={styles.statKicker}>Level</Text>
          <Text style={styles.statValue}>
            {rank} of {MAX_RANK}
          </Text>
        </Card>
      </View>

      <Button label="Start practice" glow onPress={() => router.push('/practice')} style={styles.cta} />
      <View style={styles.secondaryRow}>
        <Button
          label="Difficulty"
          variant="secondary"
          onPress={() => router.push('/settings')}
          style={styles.grow}
        />
        <Button
          label="Progress"
          variant="secondary"
          onPress={() => router.push('/progress')}
          style={styles.grow}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: 40 },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: font.weightHeading,
    lineHeight: 35,
    marginTop: 8,
    marginBottom: 10,
  },
  blurb: { color: textAlpha[65], fontSize: 14, lineHeight: 22, maxWidth: 280 },
  wave: { marginTop: 28 },
  spacer: { flex: 1 },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  stat: { flex: 1, padding: 14 },
  statKicker: {
    color: colors.accent,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statValue: { color: colors.text, fontSize: 21, fontWeight: font.weightHeading },
  cta: { minHeight: 52 },
  secondaryRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  grow: { flex: 1 },
});
