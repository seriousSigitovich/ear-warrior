// First run: no screens to read. The new learner plays a first melody (the opening of Beethoven's
// Fifth, services/melody/curated `firstMelody`) on its own focused screen (app/first-melody.tsx) in
// three named steps — Listen, Play, Check — with one instruction at a time, said at the moment of the
// action. Pure content + the persisted "seen" flag over a key-value store.
import type { KeyValueStore } from './deviceId';
import type { AttemptGrade } from '../models';
import { STRING_LABELS } from './fretboard';

export const ONBOARDED_KEY = 'ew.onboarded';

/** The steps shown at the top of the screen, in order. */
export const FIRST_STEPS = ['Listen', 'Play', 'Check'] as const;
export type FirstStep = 0 | 1 | 2;

/** Misses after which "Show me" (the answer on the board) is offered. */
export const SHOW_ME_AFTER = 2;

/** Readable name of a string for the coaching lines: "D", or "high E" for the thin one. */
export function stringName(string: number): string {
  return string === STRING_LABELS.length - 1 ? 'high E' : STRING_LABELS[string];
}

/**
 * The one instruction while answering, from the notes placed so far, the target pitches and the
 * string the whole melody sits on. A new pitch is announced with its direction: the first melody is
 * meant to be won, and "lower" with "the frets above" turns it into a search, not a guess.
 */
export function playCoach(placed: number, target: readonly number[], string: number): string {
  if (placed === 0) return 'Tap the glowing fret. That is the first note.';
  if (placed >= target.length)
    return 'Sounds right? Press Check. If not, tap another fret: it replaces the last note.';
  const prev = target[placed - 1];
  const next = target[placed];
  if (next === prev) return 'The next note is the same. Tap it again.';
  const where = next < prev ? 'lower: tap the frets above it' : 'higher: tap the frets below it';
  return `The next note is ${where}, on the ${stringName(string)} string, until it sounds right.`;
}

/** Leading notes the learner got right: kept on the board for the next try. */
export function rightPrefix(grade: AttemptGrade): number {
  const i = grade.noteResults.findIndex((r) => r.status !== 'matched');
  return i === -1 ? grade.noteResults.length : i;
}

/** Headline and the one line under it after a miss. */
export function missCoach(grade: AttemptGrade): { title: string; line: string } {
  const right = grade.noteResults.filter((r) => r.status === 'matched').length;
  const total = grade.noteResults.filter((r) => r.targetIndex !== null).length;
  const wrong = grade.noteResults.find((r) => r.status !== 'matched');
  const way =
    wrong?.expectedMidi != null &&
    wrong.detectedMidi != null &&
    wrong.expectedMidi !== wrong.detectedMidi
      ? wrong.expectedMidi > wrong.detectedMidi
        ? ' It should be higher.'
        : ' It should be lower.'
      : '';
  const n = wrong?.targetIndex != null ? wrong.targetIndex + 1 : right + 1;
  return {
    title: `Almost: ${right} of ${total} right`,
    line: `Note ${n} is off.${way} The right ones stay on the board.`,
  };
}

/** The payoff once the melody is right. */
export function doneCoach(byEar: boolean): { title: string; line: string } {
  return byEar
    ? { title: 'You played it by ear', line: "That was Beethoven's Fifth. No tabs, just your ear." }
    : {
        title: "That's how it goes",
        line: "Beethoven's Fifth. Next time you'll find it yourself.",
      };
}

export async function isOnboarded(kv: KeyValueStore): Promise<boolean> {
  return (await kv.getItem(ONBOARDED_KEY)) === '1';
}

export async function markOnboarded(kv: KeyValueStore): Promise<void> {
  await kv.setItem(ONBOARDED_KEY, '1');
}
