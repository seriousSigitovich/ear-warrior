// Per-note result chips (T031, FR-006): matched / wrong / missed / extra, with octave-mismatch hint.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NoteResult, NoteStatus } from '../../models';
import { noteName } from '../../lib/pitchNote';

const STATUS_COLOR: Record<NoteStatus, string> = {
  matched: '#2B8A3E',
  wrong: '#C92A2A',
  missed: '#5C5F66',
  extra: '#9C36B5',
};

export function NoteResultChips({ results }: { results: NoteResult[] }) {
  return (
    <View style={styles.wrap}>
      {results.map((r, i) => (
        <View
          key={i}
          accessibilityLabel={chipLabel(r)}
          style={[styles.chip, { backgroundColor: STATUS_COLOR[r.status] }]}
        >
          <Text style={styles.chipText}>{chipText(r)}</Text>
        </View>
      ))}
    </View>
  );
}

function chipText(r: NoteResult): string {
  const midi = r.detectedMidi ?? r.expectedMidi;
  const name = midi === null || midi === undefined ? '?' : noteName(midi);
  const suffix = r.octaveMismatch ? ' (8ve)' : '';
  return `${name}${suffix}`;
}

function chipLabel(r: NoteResult): string {
  return `${r.status}${r.octaveMismatch ? ', wrong octave' : ''}`;
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999 },
  chipText: { color: '#fff', fontWeight: '600' },
});
