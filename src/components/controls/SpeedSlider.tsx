// Playback-speed slider (50–100% of the tune's own tempo, 5% steps). Plain RN — a PanResponder over a
// measured track, no native slider module — so it ships over the air. A tap jumps to the spot, a drag
// follows the finger, and screen readers adjust it as an "adjustable" in steps. A melody that is
// sounding follows it at once.
import React, { useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from 'react-native';
import { SPEED_STEP, snapSpeed, speedAt, speedFraction, speedLabel } from '../../lib/speed';
import { colors, radius, textAlpha, withAlpha } from '../../theme/nocturne';

const THUMB = 18;
const TOUCH_HEIGHT = 36;

export interface SpeedSliderProps {
  speed: number;
  /** Called on every step crossed while dragging, and on release. */
  onChange: (speed: number) => void;
}

export function SpeedSlider({ speed, onChange }: SpeedSliderProps) {
  const [width, setWidth] = useState(0);
  // The responder is created once; it reads the latest width and callback through refs.
  const widthRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastRef = useRef(speed);
  lastRef.current = speed;

  const emit = (x: number) => {
    const next = speedAt(x, widthRef.current);
    if (next !== lastRef.current) {
      lastRef.current = next;
      onChangeRef.current(next);
    }
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Keep the drag even if the finger wanders vertically (the screen may scroll around it).
      onPanResponderTerminationRequest: () => false,
      // The touch lands on the track itself (its children ignore touches), so at the grant locationX
      // is along the track and pageX − locationX is where the track starts on screen; the drag is
      // measured from there.
      onPanResponderGrant: (e) => {
        originRef.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
        emit(e.nativeEvent.locationX);
      },
      onPanResponderMove: (_e, g) => emit(g.moveX - originRef.current),
    }),
  ).current;
  const originRef = useRef(0);

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
    setWidth(e.nativeEvent.layout.width);
  };

  const left = speedFraction(speed) * width;
  const step = (dir: 1 | -1) => onChange(snapSpeed(speed + dir * SPEED_STEP));

  return (
    <View style={styles.row}>
      <Text style={styles.label}>Speed</Text>
      <View
        style={styles.touch}
        onLayout={onLayout}
        {...responder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Playback speed"
        accessibilityValue={{ text: speedLabel(speed) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      >
        <View style={styles.track} pointerEvents="none">
          <View style={[styles.fill, { width: left }]} />
        </View>
        {width > 0 ? (
          <View pointerEvents="none" style={[styles.thumb, { left: left - THUMB / 2 }]} />
        ) : null}
      </View>
      <Text style={styles.value}>{speedLabel(speed)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  label: { color: textAlpha[60], fontSize: 13, letterSpacing: 0.4 },
  touch: { flex: 1, height: TOUCH_HEIGHT, justifyContent: 'center', marginHorizontal: THUMB / 2 },
  track: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: withAlpha(colors.text, 0.14),
    overflow: 'hidden',
  },
  fill: { height: 4, backgroundColor: colors.accent },
  thumb: {
    position: 'absolute',
    top: (TOUCH_HEIGHT - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  value: {
    color: colors.text,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    minWidth: 40,
    textAlign: 'right',
  },
});
