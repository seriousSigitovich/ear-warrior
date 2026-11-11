// What the finished tunes say about the learner's ear, for the Progress screen (specs 010, 011): which
// kind of melodic move they land least. Everything is counted per note — a tune with one wrong note in
// fifty is a good tune, not a failed one. Pure: attempts in, numbers and words out.
import { Attempt, Melody, NoteResult } from '../models';

/** Tries a kind of move needs before its percentage is shown: fewer says nothing. */
export const MIN_TRIES = 5;
/** At or above this a kind of move needs no fixing. */
export const STRONG_PCT = 85;

export type IntervalSize = 'step' | 'third' | 'fourthFifth' | 'wide';
export type IntervalKind = 'repeat' | `${IntervalSize}:up` | `${IntervalSize}:down`;

/**
 * The kind of melodic move `semitones` is (signed: up is positive). Fourths and fifths share a class,
 * and so do sixths and wider, so each class gathers enough tries to mean something for a beginner.
 */
export function intervalKind(semitones: number): IntervalKind {
  const size = Math.abs(semitones);
  if (size === 0) return 'repeat';
  const cls: IntervalSize =
    size <= 2 ? 'step' : size <= 4 ? 'third' : size <= 7 ? 'fourthFifth' : 'wide';
  return `${cls}:${semitones > 0 ? 'up' : 'down'}`;
}

// Everyday words, not music theory: a beginner does not know a fourth from a fifth, but hears a jump.
const SIZE_LABEL: Record<IntervalSize, string> = {
  step: 'Small steps',
  third: 'Skips',
  fourthFifth: 'Jumps',
  wide: 'Big jumps',
};
const SIZE_RISE: Record<IntervalSize, number> = { step: 1, third: 2, fourthFifth: 3, wide: 4 };

const parts = (kind: Exclude<IntervalKind, 'repeat'>) =>
  kind.split(':') as [IntervalSize, 'up' | 'down'];

export function intervalLabel(kind: IntervalKind): string {
  if (kind === 'repeat') return 'The same note again';
  const [size, direction] = parts(kind);
  return `${SIZE_LABEL[size]} ${direction}`;
}

/** How far a kind of move goes, for drawing it: 0 (same note) to ±4 (big jump), up positive. */
export function intervalRise(kind: IntervalKind): number {
  if (kind === 'repeat') return 0;
  const [size, direction] = parts(kind);
  return direction === 'up' ? SIZE_RISE[size] : -SIZE_RISE[size];
}

/** The weak spot as a sentence: "Big jumps up trip you". */
export function weakSpotTitle(kind: IntervalKind): string {
  return `${intervalLabel(kind)} ${kind === 'repeat' ? 'trips' : 'trip'} you`;
}

/** One note of a finished tune as the learner met it. */
export interface NoteEvent {
  expected: number;
  /** What was played there; null when the note was not played at all. */
  played: number | null;
  hit: boolean;
  /** The tune's note before it in the same phrase; null at the start of a phrase. */
  prev: number | null;
  /** Wrong, but the right note in another octave. */
  octave: boolean;
}

/**
 * Attempts that say something about the ear: answered on the fretboard (an attempt stored before it
 * existed has no mode and was a microphone capture) and not timed out.
 */
export function scoredAttempts(attempts: readonly Attempt[]): Attempt[] {
  return attempts.filter((a) => a.inputMode === 'fretboard' && !a.timedOut);
}

type Target = NoteResult & { targetIndex: number; expectedMidi: number };

/** The notes of every scored attempt in order; `melodies` supply the phrase boundaries. */
export function noteEvents(
  attempts: readonly Attempt[],
  melodies: readonly Pick<Melody, 'id' | 'phrases'>[],
): NoteEvent[] {
  const phrasesOf = new Map(melodies.map((m) => [m.id, m.phrases]));
  return scoredAttempts(attempts).flatMap((a) => {
    const starts = new Set<number>([0]);
    let at = 0;
    for (const len of phrasesOf.get(a.melodyId) ?? []) {
      starts.add(at);
      at += len;
    }
    const targets = a.noteResults
      .filter((r): r is Target => r.targetIndex !== null && r.expectedMidi !== null)
      .sort((x, y) => x.targetIndex - y.targetIndex);
    return targets.map((r, i) => ({
      expected: r.expectedMidi,
      played: r.status === 'missed' ? null : r.detectedMidi,
      hit: r.status === 'matched',
      prev: i === 0 || starts.has(r.targetIndex) ? null : targets[i - 1].expectedMidi,
      octave: r.status === 'wrong' && r.octaveMismatch,
    }));
  });
}

export interface IntervalStat {
  kind: IntervalKind;
  label: string;
  /** Notes played that were reached by this kind of move. */
  tries: number;
  hits: number;
  pct: number;
}

/**
 * How often the note after each kind of move is landed, weakest first. Only notes that were played and
 * have a note before them in their phrase count: a note not played says nothing about the ear, and a
 * phrase's first note is found with nothing to move from. `thin` is how many kinds have tries but too
 * few to show.
 */
export function intervalStats(
  events: readonly NoteEvent[],
  minTries = MIN_TRIES,
): { stats: IntervalStat[]; thin: number } {
  const tally = new Map<IntervalKind, { tries: number; hits: number }>();
  for (const e of events) {
    if (e.prev === null || e.played === null) continue;
    const kind = intervalKind(e.expected - e.prev);
    const t = tally.get(kind) ?? { tries: 0, hits: 0 };
    t.tries += 1;
    if (e.hit) t.hits += 1;
    tally.set(kind, t);
  }
  const all = [...tally.entries()].map(([kind, t]) => ({
    kind,
    label: intervalLabel(kind),
    tries: t.tries,
    hits: t.hits,
    pct: Math.round((t.hits / t.tries) * 100),
  }));
  const stats = all
    .filter((s) => s.tries >= minTries)
    // Weakest first; between equals the one tried more often, then by name, for a stable order.
    .sort((x, y) => x.pct - y.pct || y.tries - x.tries || x.label.localeCompare(y.label));
  return { stats, thin: all.length - stats.length };
}

/** The kind of move to work on: the weakest one that is not already strong, if any. */
export function weakestInterval(stats: readonly IntervalStat[]): IntervalStat | null {
  const weakest = stats[0];
  return weakest && weakest.pct < STRONG_PCT ? weakest : null;
}
