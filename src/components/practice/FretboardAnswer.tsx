// "Your turn" stage for fretboard input: prompt, one slot per melody note (filled with the note name
// as it is placed), a progress caption and the fretboard to tap. Controls live in FretboardControls.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FretPosition, FretTap } from '../../lib/fretboard';
import { noteName } from '../../lib/pitchNote';
import { Fretboard } from '../fretboard/Fretboard';
import { colors, font, textAlpha, withAlpha } from '../../theme/nocturne';

export interface FretboardAnswerProps {
  /** Notes in the target melody — the number of slots. */
  noteCount: number;
  taps: FretTap[];
  onTap: (position: FretPosition) => void;
}

export function FretboardAnswer({ noteCount, taps, onTap }: FretboardAnswerProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>Your turn</Text>
        <Text style={styles.sub}>
          {taps.length} of {noteCount} placed. Tap a fret to hear it, then check.
        </Text>
      </View>

      <View style={styles.slots}>
        {Array.from({ length: noteCount }, (_, i) => (
          <Slot key={i} state={i < taps.length ? 'filled' : i === taps.length ? 'next' : 'pending'}>
            {taps[i] ? noteName(taps[i].midi) : ''}
          </Slot>
        ))}
      </View>

      <Fretboard taps={taps} onTap={onTap} style={styles.board} />
    </View>
  );
}

function Slot({ state, children }: { state: 'filled' | 'next' | 'pending'; children: string }) {
  return (
    <View style={[styles.slot, SLOT_LOOK[state]]}>
      <Text style={styles.slotText}>{children}</Text>
    </View>
  );
}

const SLOT_LOOK = StyleSheet.create({
  filled: { backgroundColor: withAlpha(colors.accent, 0.22), borderColor: colors.accent },
  next: { borderColor: colors.accent },
  pending: { borderColor: colors.divider },
});

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 14 },
  head: { gap: 4 },
  title: { color: colors.accent, fontSize: 22, fontWeight: font.weightHeading },
  sub: { color: textAlpha[65], fontSize: 13 },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotText: { color: colors.accentRamp[300], fontSize: 12, fontWeight: '600' },
  board: { flex: 1 },
});
