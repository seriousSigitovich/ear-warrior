// What the answer screen keeps out of sight until asked (spec 021): the settings icon in the navigation bar
// opens this panel under the bar — playback speed, Draft, Hear whole melody, Skip to the saved phrase, Clear
// answer. Nothing else is on the screen besides the fretboard, the note row and the phrase title.
import React from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { draftToggleAnnouncement } from '../../lib/fretboardA11y';
import { SPEED_PRESETS, snapSpeed, speedLabel } from '../../lib/speed';
import { colors, radius, textAlpha } from '../../theme/nocturne';

export interface SettingsPanelProps {
  speed: number;
  onSpeed: (speed: number) => void;
  draft: boolean;
  onToggleDraft: () => void;
  /** Present on the first phrase of a longer tune, until a note is placed. */
  onHearWhole?: () => void;
  /** Present when an earlier visit stopped at a later phrase, until a note is placed. */
  skipToSaved?: { label: string; onPress: () => void };
  /** Present when there is something to clear. */
  onClear?: () => void;
  onClose: () => void;
}

export function SettingsPanel({
  speed,
  onSpeed,
  draft,
  onToggleDraft,
  onHearWhole,
  skipToSaved,
  onClear,
  onClose,
}: SettingsPanelProps) {
  const current = snapSpeed(speed);
  const done = (action: () => void) => () => {
    onClose();
    action();
  };
  return (
    <View style={styles.panel} accessibilityViewIsModal>
      <View style={styles.row}>
        <Text style={styles.label}>Speed</Text>
        <View style={styles.seg} accessibilityRole="radiogroup">
          {SPEED_PRESETS.map((p) => {
            const on = Math.abs(current - p) < 0.025;
            return (
              <Pressable
                key={p}
                accessibilityRole="radio"
                accessibilityLabel={`Speed ${speedLabel(p)}`}
                accessibilityState={{ checked: on }}
                onPress={() => onSpeed(p)}
                style={[styles.segItem, on && styles.segOn]}
              >
                <Text style={[styles.segText, on && styles.segTextOn]}>{speedLabel(p)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        accessibilityRole="switch"
        accessibilityLabel="Draft mode"
        accessibilityState={{ checked: draft }}
        onPress={() => {
          AccessibilityInfo.announceForAccessibility(draftToggleAnnouncement(!draft));
          onToggleDraft();
        }}
        style={styles.row}
      >
        <Text style={styles.label}>Draft mode</Text>
        <View style={[styles.track, draft && styles.trackOn]}>
          <View style={[styles.thumb, draft && styles.thumbOn]} />
        </View>
      </Pressable>

      {onHearWhole ? (
        <Action label="Hear whole melody" glyph="▶" onPress={done(onHearWhole)} />
      ) : null}
      {skipToSaved ? (
        <Action label={skipToSaved.label} glyph="›" onPress={done(skipToSaved.onPress)} />
      ) : null}
      {onClear ? <Action label="Clear answer" glyph="×" warm onPress={done(onClear)} /> : null}
    </View>
  );
}

function Action({
  label,
  glyph,
  warm,
  onPress,
}: {
  label: string;
  glyph: string;
  warm?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.glyph, warm && { color: colors.warm }]}>{glyph}</Text>
    </Pressable>
  );
}

/** The navigation bar's settings icon: three sliders, drawn with Views. Lit while Draft is on. */
export function SettingsButton({
  open,
  lit,
  onPress,
}: {
  open: boolean;
  lit: boolean;
  onPress: () => void;
}) {
  const tone = lit || open ? colors.accent : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={lit ? 'Settings, Draft mode is on' : 'Settings'}
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      hitSlop={8}
      style={[styles.icon, (lit || open) && styles.iconOn]}
    >
      {[0.7, 0.3, 0.55].map((knob, i) => (
        <View key={i} style={[styles.iconLine, { backgroundColor: tone }]}>
          <View style={[styles.iconKnob, { left: `${knob * 100}%`, backgroundColor: tone }]} />
        </View>
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  label: { color: colors.text, fontSize: 15 },
  glyph: { color: textAlpha[60], fontSize: 18 },
  seg: { flexDirection: 'row', borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md, overflow: 'hidden' },
  segItem: { paddingHorizontal: 12, paddingVertical: 8, minWidth: 52, alignItems: 'center' },
  segOn: { backgroundColor: colors.accentRamp[800] },
  segText: { color: textAlpha[60], fontSize: 13 },
  segTextOn: { color: colors.text },
  track: {
    width: 42,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.neutral[800],
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: colors.accent },
  thumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.text, marginLeft: 3 },
  thumbOn: { marginLeft: 21 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  iconOn: { backgroundColor: colors.accentRamp[900] },
  iconLine: { width: 18, height: 2, borderRadius: 1 },
  iconKnob: { position: 'absolute', top: -2.5, width: 7, height: 7, borderRadius: 3.5, marginLeft: -3.5 },
});
