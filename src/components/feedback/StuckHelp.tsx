// A way out of a phrase that keeps failing (beta analytics 2026-11-06: a tester retried one phrase six
// times, all wrong, and never came back). Retries never lower the rank (FR-011a), so the learner is
// offered, in growing order of give: the first note marked on the board, the whole answer on the
// board, or an easier melody.
import React, { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { colors, font, textAlpha } from '../../theme/nocturne';

export interface StuckHelpProps {
  onFirstNote: () => void;
  onShowAnswer: () => void;
  /** Absent on the lowest level, where there is nothing easier. */
  onEasier?: () => void;
}

const TITLE = 'Stuck on this one?';
const BODY = 'That happens. Take a hint, see the answer, or switch to an easier melody.';

export function StuckHelp({ onFirstNote, onShowAnswer, onEasier }: StuckHelpProps) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${TITLE} ${BODY}`);
  }, []);

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{TITLE}</Text>
      <Text style={styles.body}>{BODY}</Text>
      <View style={styles.row}>
        <Button
          label="Show first note"
          variant="secondary"
          onPress={onFirstNote}
          style={styles.grow}
        />
        <Button
          label="Show answer"
          variant="secondary"
          onPress={onShowAnswer}
          style={styles.grow}
        />
      </View>
      {onEasier ? <Button label="Easier melody" variant="ghost" onPress={onEasier} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, padding: 16 },
  title: { color: colors.text, fontSize: 15, fontWeight: font.weightHeading },
  body: { color: textAlpha[65], fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', gap: 8 },
  grow: { flex: 1 },
});
