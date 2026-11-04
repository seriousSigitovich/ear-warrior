// "Your turn" stage for fretboard input: prompt, one slot per melody note (filled with the note name
// as it is placed), a progress caption and the fretboard to tap. Controls live in FretboardControls.
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FretPosition, FretTap } from '../../lib/fretboard';
import { placementAnnouncement } from '../../lib/fretboardA11y';
import { SLOT_GAP, slotLayout, slotScrollX } from '../../lib/fretboardLayout';
import { noteName } from '../../lib/pitchNote';
import { Fretboard } from '../fretboard/Fretboard';
import { LISTENING_BARS, Waveform } from '../common/Waveform';
import { colors, font, textAlpha, withAlpha } from '../../theme/nocturne';

export interface FretboardAnswerProps {
  /** Notes in the target melody — the number of slots. */
  noteCount: number;
  taps: FretTap[];
  onTap: (position: FretPosition) => void;
  /** The melody is being replayed: the caption says so, the board and slots stay as they are. */
  replaying?: boolean;
}

export function FretboardAnswer({ noteCount, taps, onTap, replaying }: FretboardAnswerProps) {
  // Each tap, undo or clear is spoken to screen-reader users; the board itself does not change label.
  const announced = useRef(taps.length);
  useEffect(() => {
    if (announced.current === taps.length) return;
    announced.current = taps.length;
    AccessibilityInfo.announceForAccessibility(placementAnnouncement(taps, noteCount));
  }, [taps, noteCount]);

  // The slots stay on one row however long the melody, so the board keeps its height on every level.
  // Past what fits even at the minimum size the row scrolls by whole slots (never resting on a cut
  // one), following the next slot to fill.
  const [slotsWidth, setSlotsWidth] = useState(0);
  const slots = slotLayout(noteCount, slotsWidth);
  const slotRow = useRef<ScrollView>(null);
  const next = Math.min(taps.length, noteCount - 1);
  useEffect(() => {
    slotRow.current?.scrollTo({ x: slotScrollX(next, noteCount, slotsWidth), animated: true });
  }, [next, noteCount, slotsWidth]);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>Your turn</Text>
        {replaying ? (
          <View style={styles.listening}>
            <Waveform
              bars={LISTENING_BARS}
              height={14}
              barWidth={3}
              gap={2}
              align="center"
              animated
            />
            <Text style={styles.sub}>Listening… tap a fret to stop.</Text>
          </View>
        ) : (
          <Text style={styles.sub}>
            {taps.length} of {noteCount} placed. Tap a fret to hear it, then check.
          </Text>
        )}
      </View>

      <ScrollView
        ref={slotRow}
        horizontal
        scrollEnabled={slots.scrolls}
        showsHorizontalScrollIndicator={false}
        snapToInterval={slots.size + SLOT_GAP}
        decelerationRate="fast"
        onLayout={(e) => setSlotsWidth(e.nativeEvent.layout.width)}
        style={styles.slotRow}
        contentContainerStyle={styles.slots}
      >
        {Array.from({ length: noteCount }, (_, i) => (
          <Slot
            key={i}
            size={slots.size}
            state={i < taps.length ? 'filled' : i === taps.length ? 'next' : 'pending'}
          >
            {taps[i] ? noteName(taps[i].midi) : ''}
          </Slot>
        ))}
      </ScrollView>

      {/* The prompt and slots stay put; only the board scrolls, and only on a phone too short for
          the board's minimum fret rows (see Fretboard's MIN_ROW_HEIGHT). */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        delaysContentTouches={false}
      >
        <Fretboard taps={taps} onTap={onTap} style={styles.board} />
      </ScrollView>
    </View>
  );
}

function Slot({
  state,
  size,
  children,
}: {
  state: 'filled' | 'next' | 'pending';
  size: number;
  children: string;
}) {
  return (
    <View
      style={[styles.slot, { width: size, height: size, borderRadius: size / 2 }, SLOT_LOOK[state]]}
    >
      {/* The slot cannot grow, so a large system font is capped to keep "C#4" inside it. */}
      <Text style={styles.slotText} maxFontSizeMultiplier={1.2}>
        {children}
      </Text>
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
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  head: { gap: 4 },
  title: { color: colors.accent, fontSize: 22, fontWeight: font.weightHeading },
  sub: { color: textAlpha[65], fontSize: 13 },
  listening: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slotRow: { flexGrow: 0 },
  slots: { gap: SLOT_GAP },
  slot: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotText: { color: colors.accentRamp[300], fontSize: 12, fontWeight: '600' },
  board: { flex: 1 },
});
