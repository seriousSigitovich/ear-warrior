// Difficulty settings screen (US2 surface, T041). The adaptive/fixed ladder lands with
// User Story 2; this redesign brings the screen onto Nocturne now — a working mode toggle,
// a six-step level ladder, and a current-level card driven by the seeded L1 configuration.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DifficultyMode } from '../src/models';
import { L1 } from '../src/services/melody/levels';
import { noteName } from '../src/lib/pitchNote';
import { Screen } from '../src/components/common/Screen';
import { Kicker } from '../src/components/common/Kicker';
import { Card } from '../src/components/common/Card';
import { colors, font, radius, textAlpha } from '../src/theme/nocturne';

const TOTAL_LEVELS = 6;

function humanScale(scale: string): string {
  return scale.replace(/_/g, ' ');
}

export default function Settings() {
  const [mode, setMode] = useState<DifficultyMode>('adaptive');
  const rank = L1.rank; // current level (1-based)

  return (
    <Screen>
      <Kicker>Settings</Kicker>
      <Text style={styles.title}>Difficulty</Text>

      <View style={styles.seg}>
        <SegOption label="Adaptive" active={mode === 'adaptive'} onPress={() => setMode('adaptive')} />
        <SegOption label="Fixed" active={mode === 'fixed'} onPress={() => setMode('fixed')} last />
      </View>

      <View style={styles.dots}>
        {Array.from({ length: TOTAL_LEVELS }, (_, i) => (
          <LevelDot key={i} state={i + 1 < rank ? 'done' : i + 1 === rank ? 'current' : 'todo'} />
        ))}
      </View>
      <Text style={styles.ladderCaption}>
        Level {rank} of {TOTAL_LEVELS} — where you’re starting
      </Text>

      <Card style={styles.levelCard}>
        <Text style={styles.cardKicker}>Current level</Text>
        <Text style={styles.cardTitle}>
          Level {rank} · Getting started
        </Text>
        <View style={styles.hr} />
        <Row label="Notes per melody" value={`${L1.noteCount}`} />
        <Row label="Pitch range" value={`${noteName(L1.rangeLowMidi)}–${noteName(L1.rangeHighMidi)}`} />
        <Row label="Tempo" value={`${L1.tempoBpm} BPM`} />
        <Row label="Scale" value={humanScale(L1.scale)} />
      </Card>

      <View style={styles.spacer} />
      <Text style={styles.footnote}>
        Adaptive mode raises or lowers the level after a run of correct or incorrect attempts.
      </Text>
    </Screen>
  );
}

function SegOption({
  label,
  active,
  onPress,
  last,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.segOpt, !last && styles.segDivider, active && styles.segActive]}
    >
      <Text style={[styles.segText, active && styles.segTextActive]}>{label}</Text>
    </Pressable>
  );
}

function LevelDot({ state }: { state: 'done' | 'current' | 'todo' }) {
  if (state === 'current') return <View style={styles.dotCurrent} />;
  if (state === 'done') return <View style={styles.dotDone} />;
  return <View style={styles.dotTodo} />;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 26, fontWeight: font.weightHeading, marginTop: 6, marginBottom: 22 },

  seg: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: 26,
  },
  segOpt: { paddingVertical: 7, paddingHorizontal: 14 },
  segDivider: { borderRightWidth: 1, borderRightColor: colors.divider },
  segActive: { borderWidth: 1, borderColor: colors.accent, margin: -1, borderRadius: radius.md },
  segText: { color: colors.text, fontSize: 13 },
  segTextActive: { color: colors.accent },

  dots: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dotDone: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.neutral[600] },
  dotCurrent: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  dotTodo: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.divider },
  ladderCaption: { color: textAlpha[60], fontSize: 13, marginBottom: 24 },

  levelCard: { padding: 16, gap: 10 },
  cardKicker: { color: colors.accent, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: font.weightHeading },
  hr: { height: 1, backgroundColor: colors.divider, marginVertical: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: textAlpha[65], fontSize: 13 },
  rowValue: { color: colors.text, fontSize: 13 },

  spacer: { flex: 1 },
  footnote: { color: textAlpha[45], fontSize: 12, lineHeight: 18 },
});
