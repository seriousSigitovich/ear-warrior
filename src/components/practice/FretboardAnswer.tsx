// "Your turn" stage for fretboard input: prompt, one slot per melody note (filled with the note name
// as it is placed), a progress caption and the fretboard to tap. Controls live in FretboardControls.
// Until the first tap the prompt says outright what to do next and the board's frame pulses: half of
// the learners who heard a melody never started answering it (funnel, 2026-11-08).
// Draft (spec 008): a switch in the header; while on, taps only sound, the title and caption say so and
// the slots dim. What a draft tap does is the screen's business (it passes a different onTap).
import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FretPosition, FretTap } from '../../lib/fretboard';
import {
  draftTapAnnouncement,
  draftToggleAnnouncement,
  hintAnnouncement,
  placementAnnouncement,
} from '../../lib/fretboardA11y';
import { SLOT_GAP, slotLayout, slotScrollX } from '../../lib/fretboardLayout';
import { noteName } from '../../lib/pitchNote';
import { Fretboard } from '../fretboard/Fretboard';
import { LISTENING_BARS, Waveform, useReduceMotion } from '../common/Waveform';
import { colors, font, radius, textAlpha, withAlpha } from '../../theme/nocturne';

export interface FretboardAnswerProps {
  /** Notes in the target melody — the number of slots. */
  noteCount: number;
  taps: FretTap[];
  onTap: (position: FretPosition) => void;
  /** The melody is being replayed: the caption says so, the board and slots stay as they are. */
  replaying?: boolean;
  /** A cell to point at (the phrase's first note, once asked for). */
  hint?: FretPosition | null;
  /** Coaching line in place of the usual caption (the first melody's one-step-at-a-time tips). */
  coach?: string | null;
  /** Heading in place of "Now play it back" / "Your turn". */
  title?: string;
  /** String drawn in the accent colour (see Fretboard). */
  focusString?: number;
  /** Draft mode is on: taps only sound. Absent → no Draft switch (the first melody). */
  draft?: boolean;
  onToggleDraft?: () => void;
  /** The last draft tap: flashed on the board and spoken. A new `id` per tap. */
  flash?: { position: FretPosition; id: number; midi: number } | null;
}

export function FretboardAnswer({
  noteCount,
  taps,
  onTap,
  replaying,
  hint,
  coach,
  title,
  focusString,
  draft = false,
  onToggleDraft,
  flash,
}: FretboardAnswerProps) {
  // Each tap, undo or clear is spoken to screen-reader users; the board itself does not change label.
  const announced = useRef(taps.length);
  useEffect(() => {
    if (announced.current === taps.length) return;
    announced.current = taps.length;
    AccessibilityInfo.announceForAccessibility(placementAnnouncement(taps, noteCount));
  }, [taps, noteCount]);
  useEffect(() => {
    if (hint) AccessibilityInfo.announceForAccessibility(hintAnnouncement(hint));
  }, [hint]);
  useEffect(() => {
    if (flash) AccessibilityInfo.announceForAccessibility(draftTapAnnouncement(flash.midi));
  }, [flash]);
  const toggleDraft = onToggleDraft
    ? () => {
        AccessibilityInfo.announceForAccessibility(draftToggleAnnouncement(!draft));
        onToggleDraft();
      }
    : undefined;

  const untouched = taps.length === 0;

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
        <View style={styles.titleRow}>
          <Text style={styles.title}>
            {draft ? 'Draft' : (title ?? (untouched ? 'Now play it back' : 'Your turn'))}
          </Text>
          {toggleDraft ? <DraftSwitch on={draft} onPress={toggleDraft} /> : null}
        </View>
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
        ) : draft ? (
          <Text style={[styles.sub, styles.coach]}>
            Try frets freely — nothing is placed or scored. Turn Draft off to answer.
          </Text>
        ) : coach ? (
          <Text style={[styles.sub, styles.coach]}>{coach}</Text>
        ) : untouched ? (
          <Text style={[styles.sub, styles.coach]}>
            Tap the first note you heard on the fretboard. Every tap sounds, so try until it
            matches.
          </Text>
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
        style={[styles.slotRow, draft && styles.slotsDimmed]}
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
        <View style={styles.board}>
          <Fretboard
            taps={taps}
            onTap={onTap}
            hint={hint}
            focusString={focusString}
            flash={flash}
            draft={draft}
            style={styles.board}
          />
          {untouched && !replaying && !draft ? <NudgeFrame /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

/** A frame round the board that brightens and dims: "this is where you answer". Still if motion is reduced. */
function NudgeFrame() {
  const still = useReduceMotion();
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) {
      glow.setValue(0.6);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.15, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [still, glow]);
  return <Animated.View pointerEvents="none" style={[styles.nudge, { opacity: glow }]} />;
}

/** The Draft on/off pill. The state is in its text too ("Draft · On"), not only its colour. */
function DraftSwitch({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel="Draft mode"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.draft, on && styles.draftOn, pressed && styles.draftPressed]}
    >
      <Text style={[styles.draftText, on && styles.draftTextOn]}>
        {on ? 'Draft · On' : 'Draft'}
      </Text>
    </Pressable>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  draft: {
    minHeight: 36,
    minWidth: 64,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  draftPressed: { opacity: 0.7 },
  draftText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  draftTextOn: { color: colors.bg },
  slotsDimmed: { opacity: 0.4 },
  title: { color: colors.accent, fontSize: 22, fontWeight: font.weightHeading },
  sub: { color: textAlpha[65], fontSize: 13 },
  coach: { color: colors.text, fontSize: 14, lineHeight: 20 },
  nudge: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: radius.lg + 2,
    borderWidth: 2,
    borderColor: colors.accent,
  },
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
