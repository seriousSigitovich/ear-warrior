// Vertical fretboard (Nocturne "Fretboard answer" frame): strings run as columns, low E on the left,
// the nut at the top and frets 1–12 descending. A tap on any cell reports its (string, fret); the
// learner's answer is drawn back as numbered markers in the order the notes were placed. When
// `statuses` is given the markers take their grade colours instead (accent matched, warm wrong).
// Purely presentational — what a tap *means* lives in lib/fretboard and the practice loop.
import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { NoteStatus } from '../../models';
import {
  DOUBLE_INLAY_FRET,
  FRET_COUNT,
  FretPosition,
  FretTap,
  SINGLE_INLAY_FRETS,
  STRING_COUNT,
  STRING_LABELS,
} from '../../lib/fretboard';
import { colors, radius, textAlpha, withAlpha } from '../../theme/nocturne';

export interface FretboardProps {
  /** The answer so far, in placement order. */
  taps: FretTap[];
  /** Grade of each tap (same order); present only on the result view. */
  statuses?: NoteStatus[];
  /** Absent → read-only (result view). */
  onTap?: (position: FretPosition) => void;
  /**
   * Fixed fret height. Omit to share the available height equally, never below MIN_ROW_HEIGHT
   * (the answer view).
   */
  rowHeight?: number;
  style?: StyleProp<ViewStyle>;
}

/** Thickest on the low E, thinnest on the high e, like the real strings. */
const STRING_WIDTH = [3.5, 3, 2.5, 2, 1.5, 1];
/** Marker size; the cell is at least this wide even on a small phone. */
const MARKER = 26;
const GUTTER = 28;
/**
 * Shortest a fret row may get on the answer board. The board fills whatever height the screen
 * leaves it, so rows adapt to the phone; only on a phone too short for 13 rows at this height does
 * the answer view scroll. 44 pt / 48 dp is the touch-target ideal (spec 004 FR-009) but does not
 * fit 13 frets on current phones, so this floor is an owner-accepted exception.
 */
const MIN_ROW_HEIGHT = 30;

export function Fretboard({ taps, statuses, onTap, rowHeight, style }: FretboardProps) {
  // Last tap wins when the same cell is pressed twice, so its number is the most recent one.
  const markers = new Map<string, number>();
  taps.forEach((t, i) => markers.set(`${t.string}:${t.fret}`, i));
  const latest = statuses ? -1 : taps.length - 1;

  return (
    <View style={[styles.board, style]}>
      <View style={styles.labels}>
        <View style={{ width: GUTTER }} />
        {STRING_LABELS.map((label) => (
          <Text key={label} style={styles.stringLabel}>
            {label}
          </Text>
        ))}
      </View>

      <View style={[styles.rows, rowHeight === undefined && styles.rowsFlex]}>
        {Array.from({ length: FRET_COUNT }, (_, fret) => (
          <View
            key={fret}
            style={[styles.row, rowHeight === undefined ? styles.rowFlex : { height: rowHeight }]}
          >
            <Text style={styles.fretNumber}>{SHOWN_FRET_NUMBERS.includes(fret) ? fret : ''}</Text>
            {Array.from({ length: STRING_COUNT }, (_, string) => {
              const idx = markers.get(`${string}:${fret}`);
              return (
                <Cell
                  key={string}
                  string={string}
                  fret={fret}
                  marker={
                    idx === undefined
                      ? undefined
                      : { number: idx + 1, status: statuses?.[idx], latest: idx === latest }
                  }
                  onTap={onTap}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const SHOWN_FRET_NUMBERS = [...SINGLE_INLAY_FRETS, DOUBLE_INLAY_FRET];

interface MarkerInfo {
  number: number;
  status?: NoteStatus;
  latest: boolean;
}

function Cell({
  string,
  fret,
  marker,
  onTap,
}: {
  string: number;
  fret: number;
  marker?: MarkerInfo;
  onTap?: (position: FretPosition) => void;
}) {
  const width = STRING_WIDTH[string];
  // Inlay dots sit on the line between two strings: drawn on the right edge of the lower string's
  // cell. Single dots between D and G (strings 2|3); the 12th fret gets two, E-A-D | G-B-e halves.
  const inlay =
    (SINGLE_INLAY_FRETS.includes(fret) && string === 2) ||
    (fret === DOUBLE_INLAY_FRET && (string === 1 || string === 3));
  const label = `${STRING_LABELS[string]} string, ${fret === 0 ? 'open' : `fret ${fret}`}`;

  const content = (
    <>
      <View
        style={[
          styles.stringLine,
          {
            width,
            marginLeft: -width / 2,
            backgroundColor: withAlpha(colors.neutral[400], 0.65 - string * 0.07),
          },
        ]}
      />
      <View style={[styles.fretLine, fret === 0 ? styles.nut : styles.fretWire]} />
      {inlay ? <View style={styles.inlay} /> : null}
      {marker ? <Marker {...marker} /> : null}
    </>
  );

  if (!onTap) {
    return <View style={styles.cell}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onTap({ string, fret })}
      style={styles.cell}
    >
      {content}
    </Pressable>
  );
}

function Marker({ number, status, latest }: MarkerInfo) {
  const look =
    status === undefined
      ? styles.markerPlaced
      : status === 'matched'
        ? styles.markerMatched
        : styles.markerWrong;
  const textColor =
    status === undefined ? colors.accentRamp[300] : status === 'matched' ? colors.bg : colors.warm;
  return (
    <View style={styles.markerWrap} pointerEvents="none">
      {latest ? <View style={styles.markerRing} /> : null}
      <View style={[styles.marker, look]}>
        <Text style={[styles.markerText, { color: textColor }]}>{number}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 8,
  },
  labels: { flexDirection: 'row', paddingBottom: 4 },
  stringLabel: { flex: 1, textAlign: 'center', fontSize: 11, color: textAlpha[55] },
  rows: { flex: 1 },
  rowsFlex: { minHeight: FRET_COUNT * MIN_ROW_HEIGHT },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  rowFlex: { flex: 1, minHeight: MIN_ROW_HEIGHT },
  fretNumber: {
    width: GUTTER,
    alignSelf: 'center',
    textAlign: 'center',
    fontSize: 10,
    color: textAlpha[45],
  },
  cell: { flex: 1 },
  stringLine: { position: 'absolute', top: 0, bottom: 0, left: '50%' },
  fretLine: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  nut: { height: 4, backgroundColor: withAlpha(colors.neutral[300], 0.85) },
  fretWire: { height: 1, backgroundColor: withAlpha(colors.neutral[500], 0.3) },
  inlay: {
    position: 'absolute',
    right: -4,
    top: '50%',
    marginTop: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: withAlpha(colors.text, 0.14),
  },
  markerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Soft halo on the note just placed, so the eye finds where the last tap landed.
  markerRing: {
    position: 'absolute',
    width: MARKER + 10,
    height: MARKER + 10,
    borderRadius: (MARKER + 10) / 2,
    backgroundColor: withAlpha(colors.accent, 0.2),
  },
  marker: {
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  markerPlaced: {
    backgroundColor: withAlpha(colors.accent, 0.22),
    borderColor: colors.accent,
  },
  markerMatched: { backgroundColor: colors.accent, borderColor: colors.accent },
  markerWrong: {
    backgroundColor: withAlpha(colors.warm, 0.18),
    borderColor: colors.warm,
  },
  markerText: { fontSize: 12, fontWeight: '600' },
});
