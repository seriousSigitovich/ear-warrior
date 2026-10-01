// Difficulty settings screen (T041, US2). Backed by the persisted DifficultySettings row, so the
// mode toggle and the level picker take real effect and survive restart (FR-011b). In fixed mode the
// ladder is tappable and every rank is selectable — there is no unlock gating.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DifficultyMode, DifficultySettings } from '../src/models';
import {
  MAX_RANK,
  MIN_RANK,
  describeLeap,
  describeMotif,
  describeScales,
  getLevelByRank,
} from '../src/services/melody/levels';
import {
  DEFAULT_DIFFICULTY_SETTINGS,
  effectiveRank,
  setFixedRank,
  setMode,
} from '../src/features/difficulty/adapt';
import { defaultRowStore } from '../src/services/storage/db';
import { createDifficultySettingsRepository } from '../src/services/storage/repositories';
import { Screen } from '../src/components/common/Screen';
import { Kicker } from '../src/components/common/Kicker';
import { Card } from '../src/components/common/Card';
import { colors, font, radius, textAlpha } from '../src/theme/nocturne';

const RANKS = Array.from({ length: MAX_RANK - MIN_RANK + 1 }, (_, i) => MIN_RANK + i);

export default function Settings() {
  const [repo] = useState(() => createDifficultySettingsRepository(defaultRowStore()));
  const [settings, setSettings] = useState<DifficultySettings>(DEFAULT_DIFFICULTY_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    repo.load().then((loaded) => {
      if (!cancelled) setSettings(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [repo]);

  /** Apply a pure transition, show it immediately, and persist it. */
  const commit = useCallback(
    (next: DifficultySettings) => {
      setSettings(next);
      void repo.save(next);
    },
    [repo],
  );

  const rank = effectiveRank(settings);
  const level = getLevelByRank(rank);
  const fixed = settings.mode === 'fixed';

  return (
    <Screen>
      <Kicker>Settings</Kicker>
      <Text style={styles.title}>Difficulty</Text>

      <View style={styles.seg} accessibilityRole="radiogroup">
        <SegOption
          label="Adaptive"
          active={!fixed}
          onPress={() => commit(setMode(settings, 'adaptive' as DifficultyMode))}
        />
        <SegOption
          label="Fixed"
          active={fixed}
          onPress={() => commit(setMode(settings, 'fixed' as DifficultyMode))}
          last
        />
      </View>

      <View style={styles.dots} accessibilityRole="radiogroup">
        {RANKS.map((r) => (
          <LevelDot
            key={r}
            rank={r}
            state={r < rank ? 'done' : r === rank ? 'current' : 'todo'}
            selectable={fixed}
            onPress={() => commit(setFixedRank(settings, r))}
          />
        ))}
      </View>
      <Text style={styles.ladderCaption}>
        {fixed
          ? `Level ${rank} of ${MAX_RANK} — tap to change`
          : `Level ${rank} of ${MAX_RANK} — adjusts as you practice`}
      </Text>

      <Card style={styles.levelCard}>
        <Text style={styles.cardKicker}>Current level</Text>
        <Text style={styles.cardTitle}>
          Level {rank} · {level.noteCount} notes
        </Text>
        <View style={styles.hr} />
        <Row label="Notes per melody" value={`${level.noteCount}`} />
        <Row label="Scale" value={describeScales(level)} />
        <Row label="Largest leap" value={describeLeap(level.maxLeap)} />
        <Row label="Structure" value={describeMotif(level.motif)} />
        <Row label="Tempo" value={`${level.tempoBpm} BPM`} />
      </Card>

      <View style={styles.spacer} />
      <Text style={styles.footnote}>
        {fixed
          ? 'Fixed mode keeps this level until you change it. Your adaptive level is remembered separately.'
          : 'Adaptive mode raises the level after 3 correct melodies in a row and lowers it after 2 missed. Retries and unclear recordings don’t count.'}
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

function LevelDot({
  rank,
  state,
  selectable,
  onPress,
}: {
  rank: number;
  state: 'done' | 'current' | 'todo';
  selectable: boolean;
  onPress: () => void;
}) {
  const dot =
    state === 'current' ? styles.dotCurrent : state === 'done' ? styles.dotDone : styles.dotTodo;
  // The dots are 22–26pt, below the 44pt minimum, so the tap target is padded out around them
  // rather than the visual being enlarged (SC-009).
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: state === 'current', disabled: !selectable }}
      accessibilityLabel={`Level ${rank} of ${MAX_RANK}`}
      accessibilityHint={selectable ? 'Sets the fixed difficulty level' : undefined}
      disabled={!selectable}
      onPress={onPress}
      style={styles.dotTarget}
    >
      <View style={dot} />
    </Pressable>
  );
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
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: font.weightHeading,
    marginTop: 6,
    marginBottom: 22,
  },

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

  dots: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginHorizontal: -8 },
  // Nine ranks share the row, so targets flex to the available width (≈39pt on a 375pt phone).
  dotTarget: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
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
  dotTodo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.divider,
  },
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
