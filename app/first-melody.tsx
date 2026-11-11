// First run (replaces the three onboarding screens): the learner plays a first melody — the four
// notes that open Beethoven's Fifth — on a screen that holds only what that takes. Three named steps
// at the top (Listen → Play → Check), one instruction and one main action at a time:
//   Listen: a big play button.
//   Play:   the whole melody sits on one highlighted string; the first fret glows; the line above
//           the board says what to do next; once full, a tap swaps the last note, so the last note is
//           found by ear without undoing.
//   Check:  a miss keeps the right notes and says which note is off and which way; after two misses
//           "Show me" puts the answer on the board. Right → the payoff, then back to Home.
// Never recorded or scored. Leaving at any point counts as seen: it is offered once.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { firstMelody } from '../src/services/melody/curated';
import { DEFAULT_GRADING_CFG } from '../src/services/grading/grade';
import { createAudioPlayback } from '../src/services/audio/playback';
import { createAudioSession } from '../src/services/audio/session';
import { KEY_VALUE_TABLE, defaultRowStore } from '../src/services/storage/db';
import { keyValueOverRowStore } from '../src/lib/deviceId';
import { getDifficultyRepository } from '../src/features/difficulty/difficultyRepository';
import { PracticeLoopDeps, usePracticeLoop } from '../src/features/practice/usePracticeLoop';
import { track } from '../src/features/analytics/tracker';
import { oneStringFingering } from '../src/lib/hints';
import { MAX_FRET, OPEN_STRING_MIDI } from '../src/lib/fretboard';
import {
  FIRST_STEPS,
  FirstStep,
  SHOW_ME_AFTER,
  doneCoach,
  markOnboarded,
  missCoach,
  playCoach,
  rightPrefix,
  stringName,
} from '../src/lib/onboarding';
import { Screen } from '../src/components/common/Screen';
import { Button } from '../src/components/common/Button';
import { Card } from '../src/components/common/Card';
import { Waveform, HERO_BARS, LISTENING_BARS } from '../src/components/common/Waveform';
import { FretboardAnswer } from '../src/components/practice/FretboardAnswer';
import { NoteResultChips } from '../src/components/feedback/NoteResultChips';
import { colors, font, textAlpha, withAlpha } from '../src/theme/nocturne';

const MELODY = firstMelody();
const TARGET = MELODY.notes.map((n) => n.midi);
/** Where the melody is played: one string, all on frets (the library guarantees this tune fits). */
const LINE = oneStringFingering(TARGET) ?? [];
const STRING = LINE[0]?.string ?? 2;
/** The melody as played right, for the chips on the payoff. */
const ALL_RIGHT = TARGET.map((midi, i) => ({
  targetIndex: i,
  status: 'matched' as const,
  expectedMidi: midi,
  detectedMidi: midi,
  octaveMismatch: false,
}));

export default function FirstMelody() {
  const router = useRouter();
  const playback = useMemo(() => createAudioPlayback(), []);
  const tries = useRef(0);
  const [shown, setShown] = useState(false); // "Show me" was used

  useEffect(() => {
    // Every pitch of the highlighted string, so each tap sounds at once.
    const tones = Array.from({ length: MAX_FRET + 1 }, (_, f) => OPEN_STRING_MIDI[STRING] + f);
    void playback.preload(tones).catch(() => undefined);
  }, [playback]);

  const deps = useMemo<PracticeLoopDeps>(
    () => ({
      nextMelody: () => MELODY,
      loadHistory: async () => ({ mastered: [], recent: [] }),
      playback,
      session: createAudioSession(),
      gradingCfg: DEFAULT_GRADING_CFG,
      seed: () => 0,
      difficulty: getDifficultyRepository(),
      sessionId: 'first-melody',
      scored: () => false,
      listenFirst: true,
      tapReplacesLast: true,
      onPhraseChecked: ({ grade }) => {
        tries.current += 1;
        track('answer_check', { verdict: grade.verdict, rank: 1, intro: true, n: tries.current });
      },
    }),
    [playback],
  );
  const loop = usePracticeLoop(deps);

  const step: FirstStep =
    loop.phase === 'idle' || loop.phase === 'playingMelody'
      ? 0
      : loop.phase === 'awaitingInput'
        ? 1
        : 2;
  // The funnel's "onboarding step" rows: how far a new learner got.
  useEffect(() => track('onboarding_step', { step: step + 1, mode: 'melody' }), [step]);

  // Right first or on a later try: straight on to the payoff (the loop names the tune and plays it).
  const right = loop.phase === 'feedback' && loop.grade?.verdict === 'correct';
  const loopNextPhrase = loop.nextPhrase;
  useEffect(() => {
    if (right) void loopNextPhrase();
  }, [right, loopNextPhrase]);

  const done = useRef(false);
  const finish = useCallback((props: Record<string, number | string | boolean>) => {
    if (done.current) return;
    done.current = true;
    void markOnboarded(keyValueOverRowStore(defaultRowStore(), KEY_VALUE_TABLE));
    track('onboarding_done', { mode: 'melody', tries: tries.current, ...props });
  }, []);
  const complete = loop.phase === 'complete';
  // The right answer shows the payoff at once, not a blank frame while the loop moves on.
  const celebrate = complete || right;
  useEffect(() => {
    if (complete) finish({ skipped: false, correct: true, shown });
  }, [complete, finish, shown]);
  // Leaving mid-way (Android back) counts as seen: Home would otherwise send the learner straight back.
  useEffect(() => () => finish({ skipped: true, left: true }), [finish]);

  // Home sent the learner here; back to it (or to it fresh, when opened by a link with nothing below).
  const home = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const skip = () => {
    finish({ skipped: true });
    home();
  };

  const playing = loop.phase === 'playingMelody';
  const miss = loop.phase === 'feedback' && loop.grade && loop.grade.verdict !== 'correct';
  const full = loop.answer.length >= TARGET.length;

  return (
    <Screen style={styles.screen}>
      <View style={styles.top}>
        <Stepper step={step} complete={celebrate} />
        {celebrate ? null : (
          <Button label="Skip" variant="secondary" onPress={skip} style={styles.skip} />
        )}
      </View>

      {step === 0 ? (
        <View style={styles.center}>
          <Text style={styles.title}>Listen</Text>
          <Text style={styles.lead}>Four notes. You have heard them before.</Text>
          <PlayButton playing={playing} onPress={loop.next} />
          <Text style={styles.under}>{playing ? 'Listening…' : 'Tap to play'}</Text>
        </View>
      ) : null}

      {step === 1 ? (
        <>
          <FretboardAnswer
            noteCount={TARGET.length}
            taps={loop.answer}
            onTap={loop.tapFret}
            replaying={loop.replaying}
            hint={loop.answer.length === 0 ? LINE[0] : null}
            focusString={STRING}
            title={`Play it on the ${stringName(STRING)} string`}
            coach={playCoach(loop.answer.length, TARGET, STRING)}
          />
          <View style={styles.actions}>
            <Button
              label={loop.replaying ? 'Stop' : 'Replay'}
              variant="secondary"
              onPress={loop.replaying ? loop.stopReplay : loop.replay}
              style={styles.grow}
            />
            <Button
              label="Undo"
              variant="secondary"
              onPress={loop.undoFret}
              disabled={loop.answer.length === 0}
              style={styles.grow}
            />
            <Button
              label="Check"
              variant="filled"
              onPress={loop.submitAnswer}
              disabled={!full}
              style={styles.wide}
            />
          </View>
        </>
      ) : null}

      {miss ? (
        <>
          <View style={styles.center}>
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>{missCoach(loop.grade!).title}</Text>
              <Text style={styles.cardLine}>{missCoach(loop.grade!).line}</Text>
              <NoteResultChips results={loop.grade!.noteResults} />
            </Card>
          </View>
          <View style={styles.actions}>
            {loop.fails >= SHOW_ME_AFTER ? (
              <Button
                label="Show me"
                variant="secondary"
                onPress={() => {
                  setShown(true);
                  loop.revealAnswer(LINE);
                }}
                style={styles.grow}
              />
            ) : (
              <Button
                label="Replay"
                variant="secondary"
                onPress={loop.replay}
                style={styles.grow}
              />
            )}
            <Button
              label="Try again"
              variant="filled"
              onPress={() => loop.retryKeeping(rightPrefix(loop.grade!))}
              style={styles.wide}
            />
          </View>
        </>
      ) : null}

      {celebrate ? (
        <>
          <View style={styles.center}>
            <Waveform bars={HERO_BARS} height={56} barWidth={6} gap={5} breathe />
            <Text style={[styles.title, styles.centered]}>{doneCoach(!shown).title}</Text>
            <Text style={[styles.lead, styles.centered]}>{doneCoach(!shown).line}</Text>
            <View
              style={styles.score}
              accessible
              accessibilityLabel={`${TARGET.length} of ${TARGET.length} notes right`}
            >
              <Text style={styles.scoreValue}>
                {TARGET.length}/{TARGET.length}
              </Text>
              <Text style={styles.scoreLabel}>notes right</Text>
            </View>
            <NoteResultChips results={ALL_RIGHT} />
          </View>
          <View style={styles.actions}>
            <Button label="Hear it" variant="secondary" onPress={loop.replay} style={styles.grow} />
            <Button label="Continue" variant="filled" onPress={home} style={styles.wide} />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

/** Listen · Play · Check, the current one lit, the ones behind ticked. */
function Stepper({ step, complete }: { step: FirstStep; complete: boolean }) {
  return (
    <View
      style={styles.stepper}
      accessible
      accessibilityLabel={
        complete ? 'All steps done' : `Step ${step + 1} of 3: ${FIRST_STEPS[step]}`
      }
    >
      {FIRST_STEPS.map((label, i) => {
        const passed = complete || i < step;
        const current = !complete && i === step;
        return (
          <View key={label} style={styles.stepItem}>
            <View
              style={[styles.stepDot, passed && styles.stepPassed, current && styles.stepCurrent]}
            >
              <Text style={[styles.stepNum, (passed || current) && styles.stepNumLit]}>
                {passed ? '✓' : i + 1}
              </Text>
            </View>
            <Text style={[styles.stepLabel, (passed || current) && styles.stepLabelLit]}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** The one thing to do on the Listen step: a big round play button. */
function PlayButton({ playing, onPress }: { playing: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={playing ? 'Playing the melody' : 'Play the melody'}
      accessibilityState={{ disabled: playing }}
      disabled={playing}
      onPress={onPress}
      style={({ pressed }) => [styles.play, pressed && styles.playPressed]}
    >
      {playing ? (
        <Waveform bars={ON_PLAY_BARS} height={40} barWidth={5} align="center" animated />
      ) : (
        <View style={styles.triangle} />
      )}
    </Pressable>
  );
}

const PLAY = 132;
/** The listening bars, drawn in the ground colour so they read on the accent circle. */
const ON_PLAY_BARS = LISTENING_BARS.map((b) => ({ ...b, color: colors.bg }));

const styles = StyleSheet.create({
  screen: { paddingTop: 12 },
  // Fixed height: the row must not jump when Skip goes away at the end.
  top: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  skip: { minHeight: 36, paddingVertical: 6, paddingHorizontal: 14 },
  stepper: { flexDirection: 'row', gap: 14 },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPassed: { backgroundColor: withAlpha(colors.accent, 0.25), borderColor: colors.accent },
  stepCurrent: { backgroundColor: colors.accent, borderColor: colors.accent },
  stepNum: { color: textAlpha[55], fontSize: 12, fontWeight: '700' },
  stepNumLit: { color: colors.text },
  stepLabel: { color: textAlpha[55], fontSize: 13 },
  stepLabelLit: { color: colors.text, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  title: { color: colors.text, fontSize: 30, lineHeight: 36, fontWeight: font.weightHeading },
  lead: { color: textAlpha[70], fontSize: 16, lineHeight: 23, textAlign: 'center', maxWidth: 300 },
  centered: { textAlign: 'center' },
  under: { color: textAlpha[60], fontSize: 14 },
  play: {
    width: PLAY,
    height: PLAY,
    borderRadius: PLAY / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  playPressed: { backgroundColor: colors.accentRamp[400] },
  // A right-pointing triangle, nudged right so it looks centred in the circle.
  triangle: {
    width: 0,
    height: 0,
    marginLeft: 10,
    borderTopWidth: 26,
    borderBottomWidth: 26,
    borderLeftWidth: 42,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.bg,
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  grow: { flex: 1 },
  wide: { flex: 1.4 },
  score: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 10 },
  scoreValue: { color: colors.accent, fontSize: 40, fontWeight: font.weightHeading },
  scoreLabel: { color: textAlpha[70], fontSize: 16 },
  card: { gap: 10, padding: 18, alignSelf: 'stretch' },
  cardTitle: { color: colors.text, fontSize: 22, fontWeight: font.weightHeading },
  cardLine: { color: textAlpha[70], fontSize: 15, lineHeight: 21 },
});
