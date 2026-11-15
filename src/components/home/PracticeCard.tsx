// Home's one primary card (spec 023): either "Where you stopped" with Continue, or the Start practice card, never
// both. Under Continue sits a quiet link to start a new melody, so a learner with something half-done can still
// begin another; it is a text link, not a second button. The content fades in when the card switches state.
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { ContinueTarget } from '../../lib/lastOpened';
import { AnimatedBar } from '../common/AnimatedBar';
import { Button } from '../common/Button';
import { Kicker } from '../common/Kicker';
import { useReduceMotion } from '../common/Waveform';
import { colors, font, radius, textAlpha } from '../../theme/nocturne';

export interface PracticeCardProps {
  /** Where Continue leads; null when there is nothing to continue. */
  resume: ContinueTarget | null;
  /** The melody's name and level for the resume target. */
  tune: { name: string; rank: number } | null;
  onContinue: () => void;
  onStart: () => void;
}

export function PracticeCard({ resume, tune, onContinue, onStart }: PracticeCardProps) {
  const showResume = resume !== null && tune !== null;
  const still = useReduceMotion();
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (still) return;
    fade.setValue(0);
    const run = Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [showResume, still, fade]);

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.body, { opacity: fade }]}>
        {showResume && resume && tune ? (
          <>
            <Kicker style={styles.kicker}>
              {resume.saved ? 'Where you stopped' : 'Last opened'}
            </Kicker>
            <Text style={styles.title} numberOfLines={1}>
              {tune.name}
            </Text>
            <Text style={styles.meta}>
              Level {tune.rank} · Phrase {resume.phrase + 1} of {resume.phrases}
            </Text>
            <AnimatedBar pct={(resume.answered / resume.phrases) * 100} height={6} />
            <Button label="Continue" glow onPress={onContinue} style={styles.cta} />
            <Button
              label="Start something new"
              variant="ghost"
              onPress={onStart}
              style={styles.link}
            />
          </>
        ) : (
          <>
            <Kicker style={styles.kicker}>Ready when you are</Kicker>
            <Text style={styles.title}>Train your ear</Text>
            <Text style={styles.meta}>A short melody plays. Find it on the fretboard by ear.</Text>
            <Button label="Start practice" glow onPress={onStart} style={styles.cta} />
          </>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Grows into the free space of a tall phone; its content stays centred.
  card: {
    flexGrow: 1,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
  },
  body: { gap: 6 },
  kicker: { fontSize: 10 },
  title: { color: colors.text, fontSize: 20, fontWeight: font.weightHeading },
  meta: { color: textAlpha[55], fontSize: 13 },
  cta: { minHeight: 46, marginTop: 2 },
  link: { alignSelf: 'center' },
});
