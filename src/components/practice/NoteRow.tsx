// The note track at the bottom of the answer screen (spec 021): a scrubber. ▶/⏸ at the left, then a line with one
// mark per note of the phrase and a handle at the playing position, ⌫ at the right. It is the player and the
// editor in one:
//   - a mark is filled once a note is placed there, and the name of the note (C, F#…) stands above it;
//   - while a melody sounds, the handle slides along the line and the line lights up behind it;
//   - a tap on the track plays the phrase from the nearest note (and selects a placed note for replacement); a
//     drag slides the handle in silence and the release plays from there — a touch on the track stops what
//     sounds first, keeping its place;
//   - ⌫ takes the last note back.
// Plain RN (a PanResponder, no native slider module), so it ships over the air.
import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  NoteTimeline,
  TRACK_PAD,
  handleX,
  markCenters,
  noteAtOffset,
  rowState,
  showsNames,
} from '../../lib/noteRow';
import { colors } from '../../theme/nocturne';

export const ROW_HEIGHT = 56;
const TRANSPORT = 40;
const UNDO = 34;
const LINE_Y = 36;
const LINE_HEIGHT = 3;
const MARK = 9;
const HANDLE_W = TRACK_PAD * 2;
const HANDLE_H = 24;
const POLL_MS = 80;
/** A finger that moves less than this many dp between touching down and lifting is a tap, not a drag. */
const TAP_SLOP = 6;

export type RowTransport = 'pause' | 'play' | 'replay';

export function transportOf(playing: boolean, paused: boolean): RowTransport {
  return playing ? 'pause' : paused ? 'play' : 'replay';
}

/** "C#4" → "C#": the octave is on the board, and the name has to fit above a mark. */
function letter(name: string): string {
  return name.replace(/\d+$/, '');
}

export interface NoteRowProps {
  /** Notes in the phrase. */
  count: number;
  /** The name of the note placed at each index, '' where none is. */
  names: readonly string[];
  /** Where the notes start (ms at the tune's own tempo) and how long the phrase is; null before it is known. */
  timeline: NoteTimeline | null;
  /** A melody is sounding. */
  playing: boolean;
  /** Where it stopped (ms), when paused. */
  pausedMs: number | null;
  /** Where the sounding melody is now (ms); polled while `playing`. */
  position: () => number | null;
  /** The placed note chosen for replacement, if any. */
  selected: number | null;
  /** Pause, resume or replay, whichever ▶/⏸ shows. */
  onTransport: () => void;
  /** A touch lands on the track: silence what sounds (keeping its place). */
  onScrubStart: () => void;
  /** The finger lifts at a note: play from it. */
  onSeek: (index: number) => void;
  /** Take the last note back. */
  onUndo: () => void;
  /** Draft mode: the track dims, as the old slots did. */
  dim?: boolean;
}

export function NoteRow({
  count,
  names,
  timeline,
  playing,
  pausedMs,
  position,
  selected,
  onTransport,
  onScrubStart,
  onSeek,
  onUndo,
  dim,
}: NoteRowProps) {
  const [width, setWidth] = useState(0);
  const [now, setNow] = useState<number | null>(null);
  // A touch in progress: the note under the finger, whether the finger has travelled (a drag, not a tap) and
  // what the track showed when it landed. A tap keeps showing that, so the track does not blink.
  const [touch, setTouch] = useState<{
    index: number;
    moved: boolean;
    frozen: number | null;
  } | null>(null);
  // Where the phrase was sent from a touch, shown until the sound reports its own position.
  const [landing, setLanding] = useState<number | null>(null);

  // The playing position, read ten times a second while a melody sounds.
  useEffect(() => {
    if (!playing) {
      setNow(null);
      return;
    }
    setNow(position());
    const id = setInterval(() => setNow(position()), POLL_MS);
    return () => clearInterval(id);
  }, [playing, position]);

  // The sound has taken over (or is not coming): the landing spot is no longer needed.
  useEffect(() => {
    if (landing === null) return;
    if (playing && now !== null) {
      setLanding(null);
      return;
    }
    const id = setTimeout(() => setLanding(null), 700);
    return () => clearTimeout(id);
  }, [landing, playing, now]);

  // The responder is made once; it reads what changes through refs.
  const widthRef = useRef(0);
  const countRef = useRef(count);
  countRef.current = count;
  const originRef = useRef(0);
  const dragRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const holdRef = useRef<number | null>(null);
  const shownRef = useRef<number | null>(null);
  const startsRef = useRef<readonly number[]>([]);
  const startRef = useRef(onScrubStart);
  startRef.current = onScrubStart;
  const seekRef = useRef(onSeek);
  seekRef.current = onSeek;

  const at = (x: number, begin = false) => {
    const i = noteAtOffset(x, widthRef.current, countRef.current);
    dragRef.current = i;
    if (begin) {
      startXRef.current = x;
      setTouch({ index: i, moved: false, frozen: shownRef.current });
    } else {
      // A finger that stays within a few dp is still a tap.
      setTouch((t) => ({
        index: i,
        moved: (t?.moved ?? false) || Math.abs(x - startXRef.current) > TAP_SLOP,
        frozen: t?.frozen ?? null,
      }));
    }
  };
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      // The touch lands on the track itself (its children ignore touches), so locationX is along it and
      // pageX − locationX is where it starts on screen; the drag is measured from there.
      onPanResponderGrant: (e) => {
        originRef.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
        startRef.current();
        at(e.nativeEvent.locationX, true);
      },
      onPanResponderMove: (_e, g) => at(g.moveX - originRef.current),
      onPanResponderRelease: () => {
        const i = dragRef.current;
        dragRef.current = null;
        setTouch(null);
        if (i === null) return;
        setLanding(startsRef.current[i] ?? null);
        seekRef.current(i);
      },
      onPanResponderTerminate: () => {
        dragRef.current = null;
        setTouch(null);
      },
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
    setWidth(e.nativeEvent.layout.width);
  };

  const starts = timeline?.starts ?? [];
  startsRef.current = starts;
  const total = timeline?.totalMs ?? 0;
  // Pressing ▶ on a paused phrase flips `playing` before the sound has started and reported a position (the
  // audio mode and the old clip are settled first), so until it does the track keeps showing what it showed.
  const base = playing ? (now ?? landing ?? holdRef.current) : (landing ?? pausedMs);
  if (!playing) holdRef.current = base;
  else if (now !== null) holdRef.current = now;
  // What the track shows: while a finger drags, the note under it; during a tap, what was shown when it
  // landed; just after a release, the note it sent the phrase to; else the sounding position, else the paused place.
  const dragged = touch?.moved ? touch.index : null;
  const shown =
    dragged !== null && starts[dragged] !== undefined
      ? starts[dragged]
      : touch
        ? touch.frozen
        : base;
  if (!touch) shownRef.current = base;
  const state = rowState(shown, starts, total);
  const centers = markCenters(count, width);
  const hx = shown === null ? null : handleX(shown, starts, total, width);
  const handleAt = hx ?? centers[0] ?? 0;
  const labelled = showsNames(count, width);
  const firstEmpty = names.findIndex((n) => n === '');
  const transport = transportOf(playing, pausedMs !== null);
  const current =
    touch?.index ??
    selected ??
    (state.current >= 0 ? state.current : Math.max(0, state.played - 1));
  const placed = names.filter((n) => n !== '').length;

  return (
    <View style={[styles.row, dim && styles.dim]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          transport === 'pause'
            ? 'Pause melody'
            : transport === 'play'
              ? 'Resume melody'
              : 'Play melody'
        }
        onPress={onTransport}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        style={({ pressed }) => [styles.transport, pressed && styles.pressed]}
      >
        <TransportGlyph kind={transport} />
      </Pressable>
      <View style={styles.sep} />

      <View
        style={styles.track}
        onLayout={onLayout}
        {...responder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Position in the phrase"
        accessibilityValue={{ text: `Note ${current + 1} of ${count}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) =>
          onSeek(
            Math.min(
              count - 1,
              Math.max(0, current + (e.nativeEvent.actionName === 'increment' ? 1 : -1)),
            ),
          )
        }
      >
        {width > 0 && count > 0 ? (
          <>
            <View
              pointerEvents="none"
              style={[
                styles.line,
                { left: centers[0], width: Math.max(0, centers[count - 1] - centers[0]) },
              ]}
            />
            <View
              pointerEvents="none"
              style={[styles.line, styles.lit, { left: centers[0], width: handleAt - centers[0] }]}
            />
            {centers.map((x, i) => (
              <Mark
                key={i}
                x={x}
                filled={(names[i] ?? '') !== ''}
                next={i === firstEmpty}
                selected={i === selected && dragged === null}
              />
            ))}
            {centers.map((x, i) =>
              (names[i] ?? '') !== '' && (labelled || (i === selected && dragged === null)) ? (
                <Label
                  key={`n${i}`}
                  x={x}
                  text={letter(names[i])}
                  selected={i === selected && dragged === null}
                />
              ) : null,
            )}
            <View pointerEvents="none" style={[styles.handle, { left: handleAt - HANDLE_W / 2 }]} />
          </>
        ) : null}
      </View>

      {/* Always takes its place, so the track does not shift when the first note goes in or the last comes out. */}
      <View style={styles.undoSlot}>
        {placed > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo last note"
            onPress={onUndo}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={styles.undo}
          >
            <UndoGlyph />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Mark({
  x,
  filled,
  next,
  selected,
}: {
  x: number;
  filled: boolean;
  next: boolean;
  selected: boolean;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.mark,
        { left: x - MARK / 2 },
        filled && styles.markFilled,
        next && styles.markNext,
        selected && styles.markSelected,
      ]}
    />
  );
}

function Label({ x, text, selected }: { x: number; text: string; selected: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={[styles.label, { left: x - 14 }, selected && styles.labelSelected]}
    >
      <Text
        style={[styles.labelText, selected && styles.labelTextSelected]}
        maxFontSizeMultiplier={1.2}
        numberOfLines={1}
      >
        {text}
      </Text>
    </View>
  );
}

/** Pause bars or a play triangle, drawn with Views (no SVG), dark on the filled button. */
function TransportGlyph({ kind }: { kind: RowTransport }) {
  if (kind === 'pause') {
    return (
      <View style={styles.glyph}>
        <View style={styles.bar} />
        <View style={styles.bar} />
      </View>
    );
  }
  return <View style={styles.triangle} />;
}

/** A backspace key: a body with a pointed left end and a cross, drawn with Views. */
function UndoGlyph() {
  return (
    <View style={styles.key}>
      <View style={styles.keyTip} />
      <View style={styles.keyBody}>
        <View style={[styles.crossBar, { transform: [{ rotate: '45deg' }] }]} />
        <View style={[styles.crossBar, { transform: [{ rotate: '-45deg' }] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dim: { opacity: 0.4 },
  transport: {
    width: TRANSPORT,
    height: TRANSPORT,
    borderRadius: TRANSPORT / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  sep: { width: StyleSheet.hairlineWidth * 2, height: 28, backgroundColor: colors.divider },
  track: { flex: 1, height: ROW_HEIGHT },
  line: {
    position: 'absolute',
    top: LINE_Y,
    height: LINE_HEIGHT,
    borderRadius: LINE_HEIGHT / 2,
    backgroundColor: colors.divider,
  },
  lit: { backgroundColor: colors.accentRamp[600] },
  mark: {
    position: 'absolute',
    top: LINE_Y + LINE_HEIGHT / 2 - MARK / 2,
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    backgroundColor: colors.neutral[800],
  },
  markFilled: { backgroundColor: colors.accent },
  markNext: { borderWidth: 1.5, borderColor: colors.accent, backgroundColor: colors.bg },
  markSelected: { borderWidth: 2, borderColor: colors.text },
  label: {
    position: 'absolute',
    top: 8,
    width: 28,
    alignItems: 'center',
    borderRadius: 6,
    paddingVertical: 1,
  },
  labelSelected: { backgroundColor: colors.text },
  labelText: { color: colors.accentRamp[200], fontSize: 11, fontWeight: '600' },
  labelTextSelected: { color: colors.bg },
  handle: {
    position: 'absolute',
    top: LINE_Y + LINE_HEIGHT / 2 - HANDLE_H / 2,
    width: HANDLE_W,
    height: HANDLE_H,
    borderRadius: HANDLE_W / 2,
    backgroundColor: colors.text,
  },
  undoSlot: { width: UNDO, height: UNDO, alignItems: 'center', justifyContent: 'center' },
  undo: {
    width: UNDO,
    height: UNDO,
    borderRadius: UNDO / 2,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  bar: { width: 4, height: 14, borderRadius: 1, backgroundColor: colors.bg },
  triangle: {
    marginLeft: 3,
    width: 0,
    height: 0,
    borderTopWidth: 9,
    borderBottomWidth: 9,
    borderLeftWidth: 14,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.bg,
  },
  // The tip sticks out 1.3 dp to the left of the box, so the key is nudged right to sit centred in its button.
  key: { width: 24, height: 16, justifyContent: 'center', left: 0.7 },
  keyTip: {
    position: 'absolute',
    left: 1,
    top: 2.5,
    width: 11,
    height: 11,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: colors.text,
    transform: [{ rotate: '45deg' }],
  },
  keyBody: {
    position: 'absolute',
    left: 6,
    right: 0,
    top: 0,
    bottom: 0,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: colors.text,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crossBar: {
    position: 'absolute',
    width: 9,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: colors.text,
  },
});
