// How the last phrase or attempt went, note by note (spec 023): "6 of 8 notes", a chip per note (landed: filled, wrong: warm
// outline, missed: quiet outline) and one line that invites another go. It is the feedback loop of the app, kept in view on Home. It
// fades in when the result it shows changes.
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { LastResult } from '../../lib/lastResult';
import { Kicker } from '../common/Kicker';
import { useReduceMotion } from '../common/Waveform';
import { colors, font, textAlpha } from '../../theme/nocturne';

export function LastResultBlock({ result }: { result: LastResult }) {
  const still = useReduceMotion();
  const fade = useRef(new Animated.Value(1)).current;
  const key = `${result.kind}|${result.when}|${result.matched}|${result.total}`;
  useEffect(() => {
    if (still) return;
    fade.setValue(0);
    const run = Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [key, still, fade]);

  return (
    <Animated.View
      style={[styles.block, { opacity: fade }]}
      accessible
      accessibilityLabel={`${result.kind}${result.title ? `, ${result.title}` : ''}, ${result.when}: ${result.matched} of ${result.total} notes. ${result.line}`}
    >
      <Kicker style={styles.kicker}>
        {[result.kind, result.title, result.when].filter(Boolean).join(' · ')}
      </Kicker>
      <View style={styles.score}>
        <Text style={styles.matched}>{result.matched}</Text>
        <Text style={styles.of}>of {result.total} notes</Text>
      </View>
      <View style={styles.chips}>
        {result.notes.map((n, i) => (
          <View
            key={i}
            style={[
              styles.chip,
              n.state === 'matched' ? styles.ok : n.state === 'wrong' ? styles.bad : styles.miss,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                n.state === 'matched'
                  ? styles.okText
                  : n.state === 'wrong'
                    ? styles.badText
                    : styles.missText,
              ]}
            >
              {n.name}
            </Text>
          </View>
        ))}
        {result.hidden > 0 ? <Text style={styles.more}>+{result.hidden}</Text> : null}
      </View>
      {result.line ? <Text style={styles.line}>{result.line}</Text> : null}
    </Animated.View>
  );
}

const CHIP = 34;

const styles = StyleSheet.create({
  block: { gap: 8, alignItems: 'center' },
  kicker: { fontSize: 10, textAlign: 'center' },
  score: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  matched: { color: colors.text, fontSize: 48, lineHeight: 52, fontWeight: font.weightHeading },
  of: { color: textAlpha[55], fontSize: 20 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  chip: {
    width: CHIP,
    height: CHIP,
    borderRadius: CHIP / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ok: { backgroundColor: colors.accent },
  bad: { borderWidth: 2, borderColor: colors.warm },
  miss: { borderWidth: 2, borderColor: textAlpha[45] },
  chipText: { fontSize: 13, fontWeight: font.weightHeading },
  okText: { color: colors.bg },
  badText: { color: colors.warm },
  missText: { color: textAlpha[45] },
  more: { color: textAlpha[55], fontSize: 13, marginLeft: 2 },
  line: { color: textAlpha[55], fontSize: 14, textAlign: 'center' },
});
