// Per-note result chips (T031, FR-006): matched / wrong / missed / extra, with octave-mismatch hint.
// Redesign: four distinct, legible chip roles — accent (matched), warm (wrong), dashed neutral
// (missed), accent-2 (extra) — derived to sit harmoniously in the Nocturne palette.
import React from 'react';
import { StyleSheet, Text, View, ViewStyle, TextStyle } from 'react-native';
import { NoteResult, NoteStatus } from '../../models';
import { noteName } from '../../lib/pitchNote';
import { colors, font, radius, withAlpha } from '../../theme/nocturne';

export function NoteResultChips({ results }: { results: NoteResult[] }) {
  return (
    <View style={styles.wrap}>
      {results.map((r, i) => {
        const s = CHIP[r.status];
        return (
          <View key={i} accessibilityLabel={chipLabel(r)} style={[styles.chip, s.chip]}>
            <Text style={[styles.chipText, s.text]}>{chipText(r)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function chipText(r: NoteResult): string {
  const midi = r.detectedMidi ?? r.expectedMidi;
  const name = midi === null || midi === undefined ? '?' : noteName(midi);
  if (r.status === 'missed') return `${name} missed`;
  if (r.status === 'extra') return `${name} extra`;
  const suffix = r.octaveMismatch ? ' (8ve)' : '';
  return `${name}${suffix}`;
}

function chipLabel(r: NoteResult): string {
  return `${r.status}${r.octaveMismatch ? ', wrong octave' : ''}`;
}

const CHIP: Record<NoteStatus, { chip: ViewStyle; text: TextStyle }> = {
  matched: {
    chip: { borderColor: colors.accentRamp[700], backgroundColor: withAlpha(colors.accent, 0.08) },
    text: { color: colors.accentRamp[200] },
  },
  wrong: {
    chip: { borderColor: colors.warmBorder, backgroundColor: withAlpha(colors.warm, 0.1) },
    text: { color: colors.warm },
  },
  missed: {
    chip: { borderColor: colors.neutral[600], borderStyle: 'dashed', borderWidth: 1.5 },
    text: { color: colors.neutral[500] },
  },
  extra: {
    chip: { borderColor: colors.accent2Ramp[700], backgroundColor: withAlpha(colors.accent2, 0.08) },
    text: { color: colors.accent2Ramp[300] },
  },
};

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: font.weightHeading },
});
