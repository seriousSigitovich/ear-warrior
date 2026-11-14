// The note row at the bottom of the answer screen (spec 021): one circle per note of the phrase, ▶/⏸ at its
// left, ⌫ at its right. It is the player and the editor in one:
//   - the circles show the notes placed so far (their names), and while a melody sounds, how far it has got;
//   - a tap on a circle plays the phrase from that note (and selects a placed note for replacement); a drag
//     slides along the notes in silence and the release plays from the nearest one — a touch on the row stops
//     what sounds first, keeping its place;
//   - ⌫ takes the last note back.
// Plain RN (a PanResponder, no native slider module), so it ships over the air.
import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  NoteTimeline,
  NAME_MIN,
  noteAtOffset,
  circleCenters,
  circleSize,
  rowState,
} from '../../lib/noteRow';
import { colors } from '../../theme/nocturne';

export const ROW_HEIGHT = 44;
const BUTTON = 34;
const POLL_MS = 80;
/** A finger that moves less than this many dp between touching down and lifting is a tap, not a drag. */
const TAP_SLOP = 6;

export type RowTransport = 'pause' | 'play' | 'replay';

export function transportOf(playing: boolean, paused: boolean): RowTransport {
  return playing ? 'pause' : paused ? 'play' : 'replay';
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
  /** A touch lands on the row: silence what sounds (keeping its place). */
  onScrubStart: () => void;
  /** The finger lifts on a circle: play from that note. */
  onSeek: (index: number) => void;
  /** Take the last note back. */
  onUndo: () => void;
  /** Draft mode: the circles dim, as the old slots did. */
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
  // A touch in progress: the circle under the finger, whether the finger has travelled (a drag, not a tap) and
  // what the circles showed when it landed. A tap keeps showing that, so the row does not blink.
  const [touch, setTouch] = useState<{ index: number; moved: boolean; frozen: number | null } | null>(
    null,
  );
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
      // The touch lands on the circles area itself (its children ignore touches), so locationX is along it
      // and pageX − locationX is where it starts on screen; the drag is measured from there.
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
  // What the circles show: while a finger drags, the note under it; during a tap, what was shown when it
  // landed; just after a release, the note it sent the phrase to, until the sound reports its position; else
  // the sounding position, else the paused place.
  const base = playing && now !== null ? now : landing !== null ? landing : pausedMs;
  const dragged = touch?.moved ? touch.index : null;
  const shown =
    dragged !== null && starts[dragged] !== undefined
      ? starts[dragged]
      : touch
        ? touch.frozen
        : base;
  if (!touch) shownRef.current = base;
  const state = rowState(shown, starts, total);
  const size = circleSize(count, width);
  const centers = circleCenters(count, width);
  const firstEmpty = names.findIndex((n) => n === '');
  const transport = transportOf(playing, pausedMs !== null);
  const current = touch?.index ?? selected ?? (state.current >= 0 ? state.current : Math.max(0, state.played - 1));
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
        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        style={[styles.button, styles.play, transport !== 'replay' && styles.playOn]}
      >
        <TransportGlyph kind={transport} />
      </Pressable>

      <View
        style={styles.circles}
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
        {width > 0
          ? centers.map((x, i) => (
              <Circle
                key={i}
                left={x - size / 2}
                top={(ROW_HEIGHT - size) / 2}
                size={size}
                name={size >= NAME_MIN ? (names[i] ?? '') : ''}
                filled={(names[i] ?? '') !== ''}
                played={i < state.played}
                sounding={i === state.current}
                touched={i === dragged}
                selected={i === selected && dragged === null}
                next={i === firstEmpty}
              />
            ))
          : null}
      </View>

      {/* Always takes its place, so the circles do not shift when the first note goes in or the last comes out. */}
      <View style={styles.button}>
        {placed > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo last note"
            onPress={onUndo}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            style={styles.undo}
          >
            <UndoGlyph />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Circle({
  left,
  top,
  size,
  name,
  filled,
  played,
  sounding,
  touched,
  selected,
  next,
}: {
  left: number;
  top: number;
  size: number;
  name: string;
  /** A note is placed here (the name may be left out when the circle is too small for it). */
  filled: boolean;
  played: boolean;
  sounding: boolean;
  touched: boolean;
  selected: boolean;
  next: boolean;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.circle,
        { left, top, width: size, height: size, borderRadius: size / 2 },
        filled && styles.placed,
        next && styles.next,
        played && styles.played,
        sounding && styles.sounding,
        touched && styles.touched,
        selected && styles.selected,
      ]}
    >
      {/* The circle cannot grow, so a large system font is capped to keep "C#4" inside it. */}
      <Text
        style={[
          styles.name,
          { fontSize: size >= 20 ? 9 : 8 },
          (sounding || touched) && styles.nameDark,
        ]}
        maxFontSizeMultiplier={1.2}
        numberOfLines={1}
      >
        {name}
      </Text>
    </View>
  );
}

/** Pause bars, a play triangle or a replay ring, drawn with Views (no SVG). */
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
  button: { width: BUTTON, height: BUTTON, alignItems: 'center', justifyContent: 'center' },
  play: {
    borderRadius: BUTTON / 2,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  playOn: { borderColor: colors.accent },
  undo: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circles: { flex: 1, height: ROW_HEIGHT },
  circle: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: colors.neutral[800],
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placed: { borderColor: colors.accent, backgroundColor: colors.accentRamp[900] },
  next: { borderColor: colors.accent },
  played: { backgroundColor: colors.accentRamp[700], borderColor: colors.accentRamp[600] },
  sounding: { backgroundColor: colors.accentRamp[400], borderColor: colors.accentRamp[300] },
  touched: { backgroundColor: colors.text, borderColor: colors.text },
  selected: { borderColor: colors.text, borderWidth: 2 },
  name: { color: colors.accentRamp[200], fontWeight: '600' },
  nameDark: { color: colors.bg },
  glyph: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  bar: { width: 4, height: 14, borderRadius: 1, backgroundColor: colors.accent },
  triangle: {
    marginLeft: 3,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 13,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.accent,
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
  crossBar: { position: 'absolute', width: 9, height: 1.5, borderRadius: 1, backgroundColor: colors.text },
});
