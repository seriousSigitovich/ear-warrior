// "Your turn" stage for fretboard input: prompt, one slot per melody note (filled with the note name
// as it is placed), a progress caption and the fretboard to tap. Controls live in FretboardControls.
// Until the first tap the prompt says outright what to do next and the board's frame pulses: half of
// the learners who heard a melody never started answering it (funnel, 2026-11-08).
// Draft (spec 008, switch in the navigation bar since spec 016): while on, taps only sound, the title and caption say so and
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
  hintAnnouncement,
  placementAnnouncement,
} from '../../lib/fretboardA11y';
import { SLOT_GAP, slotLayout, slotScrollX } from '../../lib/fretboardLayout';
import { noteName } from '../../lib/pitchNote';
import { NoteTimeline } from '../../lib/noteRow';
import { Fretboard } from '../fretboard/Fretboard';
import { NoteRow } from './NoteRow';
import { LISTENING_BARS, Waveform, useReduceMotion } from '../common/Waveform';
import { colors, font, radius, textAlpha, withAlpha } from '../../theme/nocturne';

/**
 * The player layout (spec 021). With it the answer screen is the fretboard, the note row below it and, over the
 * board's bottom edge, Check once the phrase is full: no title, caption, slots or buttons. The hint line lives
 * in the navigation bar and the rest behind the settings icon. Without it (the coached first melody) the
 * screen is as it was.
 */
export interface AnswerPlayer {
  timeline: NoteTimeline | null;
  /** Where a paused replay stopped (ms); null when it is not paused. */
  pausedMs: number | null;
  position: () => number | null;
  /** The placed note chosen for replacement. */
  selected: number | null;
  /** Pause, resume or play, whichever ▶/⏸ shows. */
  onTransport: () => void;
  onScrubStart: () => void;
  onSeek: (index: number) => void;
  onUndo: () => void;
  /** The phrase is full and may be checked. */
  canCheck: boolean;
  onCheck: () => void;
}

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
  /** Draft mode is on: taps only sound. The switch itself is in the navigation bar (see DraftSwitch). */
  draft?: boolean;
  /** The last draft tap: flashed on the board and spoken. A new `id` per tap. */
  flash?: { position: FretPosition; id: number; midi: number } | null;
  /** Offer "Hear whole melody" until the first note is placed (the first phrase of a longer tune). */
  onHearWhole?: () => void;
  /** Offer to jump to the phrase an earlier visit stopped at (spec 017), until the first note is placed. */
  skipToSaved?: { label: string; onPress: () => void };
  /** The player layout (see AnswerPlayer). */
  player?: AnswerPlayer;
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
  flash,
  onHearWhole,
  skipToSaved,
  player,
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

  const boardNode = (
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
            selected={player?.selected}
            style={styles.board}
          />
          {untouched && !replaying && !draft ? <NudgeFrame /> : null}
        </View>
      </ScrollView>
  );

  if (player) {
    const names = Array.from({ length: noteCount }, (_, i) => (taps[i] ? noteName(taps[i].midi) : ''));
    return (
      <View style={styles.playerWrap}>
        <View style={styles.boardArea}>
          {boardNode}
          {player.canCheck ? (
            <View style={styles.checkWrap} pointerEvents="box-none">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Check answer"
                onPress={player.onCheck}
                style={({ pressed }) => [styles.check, pressed && styles.checkPressed]}
              >
                <Text style={styles.checkText}>Check</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
        <NoteRow
          count={noteCount}
          names={names}
          timeline={player.timeline}
          playing={!!replaying}
          pausedMs={player.pausedMs}
          position={player.position}
          selected={player.selected}
          onTransport={player.onTransport}
          onScrubStart={player.onScrubStart}
          onSeek={player.onSeek}
          onUndo={player.onUndo}
          dim={draft}
        />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>
            {draft ? 'Draft' : (title ?? (untouched ? 'Now play it back' : 'Your turn'))}
          </Text>
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
        {untouched && !draft && (onHearWhole || skipToSaved) ? (
          <View style={styles.links}>
            {skipToSaved ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={skipToSaved.label}
                onPress={skipToSaved.onPress}
                hitSlop={8}
                style={styles.whole}
              >
                <Text style={styles.wholeText}>{skipToSaved.label}</Text>
              </Pressable>
            ) : null}
            {onHearWhole ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Hear whole melody"
                onPress={onHearWhole}
                hitSlop={8}
                style={styles.whole}
              >
                <Text style={styles.wholeText}>Hear whole melody</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
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

      {boardNode}
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
  slotsDimmed: { opacity: 0.4 },
  title: { color: colors.accent, fontSize: 22, fontWeight: font.weightHeading },
  sub: { color: textAlpha[65], fontSize: 13 },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18 },
  whole: { minHeight: 32, justifyContent: 'center' },
  wholeText: { color: colors.accentRamp[300], fontSize: 13 },
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
  playerWrap: { flex: 1, gap: 8 },
  boardArea: { flex: 1 },
  checkWrap: { position: 'absolute', left: 0, right: 0, bottom: 12, alignItems: 'center' },
  check: {
    minWidth: 168,
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkPressed: { opacity: 0.85 },
  checkText: { color: colors.bg, fontSize: 16, fontWeight: '600' },
  slotRow: { flexGrow: 0 },
  slots: { gap: SLOT_GAP },
  slot: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotText: { color: colors.accentRamp[300], fontSize: 9, fontWeight: '600' },
  board: { flex: 1 },
});
