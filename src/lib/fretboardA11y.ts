// Screen-reader text for the fretboard (spec 004, checklists/fretboard-a11y.md A4). Pure, so the
// wording is unit-tested; the components only pass it to accessibilityLabel / announceForAccessibility.
import { AttemptGrade, NoteStatus } from '../models';
import { FretPosition, FretTap, STRING_LABELS } from './fretboard';
import { noteName } from './pitchNote';

function positionText(p: FretPosition): string {
  return `${STRING_LABELS[p.string]} string, ${p.fret === 0 ? 'open' : `fret ${p.fret}`}`;
}

/**
 * Label of one tappable cell. A cell holding a placed note says which note it is, so a screen-reader
 * user can find their answer on the neck (A4b).
 */
export function fretCellLabel(p: FretPosition, noteNumber?: number): string {
  const base = positionText(p);
  return noteNumber === undefined ? base : `${base}, note ${noteNumber}`;
}

/** Spoken after each tap: the pitch it sounded and how far the answer has got (A4c). */
export function placementAnnouncement(taps: FretTap[], noteCount: number): string {
  const last = taps[taps.length - 1];
  if (!last) return `0 of ${noteCount} placed`;
  return `${noteName(last.midi)}, ${taps.length} of ${noteCount} placed`;
}

/** Spoken when the verdict appears (A4c); same facts as the verdict card. */
export function verdictAnnouncement(grade: AttemptGrade): string {
  const total = grade.noteResults.filter((r) => r.targetIndex !== null).length;
  const matched = grade.noteResults.filter((r) => r.status === 'matched').length;
  return `${grade.verdict === 'correct' ? 'Correct' : 'Not quite'}, ${matched} of ${total} notes matched`;
}

/**
 * One label for the read-only result board, which is a single accessible element instead of 78
 * unlabelled cells (A4d): every tap in order, where it was and how it was graded.
 */
export function resultBoardLabel(taps: FretTap[], statuses: NoteStatus[]): string {
  if (taps.length === 0) return 'Your answer: no notes placed';
  const parts = taps.map(
    (t, i) => `${i + 1}: ${noteName(t.midi)} on ${positionText(t)}, ${statuses[i] ?? 'not graded'}`,
  );
  return `Your answer. ${parts.join('; ')}`;
}
