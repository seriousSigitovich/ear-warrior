// What the finished tunes say about the learner's ear, for the Progress screen (spec 010): how many
// notes they land (by week and by practice day), which kinds of melodic move they land least, and how
// their wrong notes tend to go. Everything is counted per note — a tune with one wrong note in fifty is
// a good tune, not a failed one. Pure: attempts in, numbers and sentences out.
import { Attempt, Melody, NoteResult } from '../models';
import { Score, scoreOf } from './review';
import { dayKey } from './streak';

/** Tries a kind of move needs before its percentage is shown: fewer says nothing. */
export const MIN_TRIES = 5;
/** Wrong notes needed before anything is said about how the misses go. */
export const MIN_MISSES = 8;
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

const SIZE_LABEL: Record<IntervalSize, string> = {
  step: 'Steps',
  third: 'Thirds',
  fourthFifth: 'Fourths & fifths',
  wide: 'Wide leaps',
};

export function intervalLabel(kind: IntervalKind): string {
  if (kind === 'repeat') return 'Repeated notes';
  const [size, direction] = kind.split(':') as [IntervalSize, 'up' | 'down'];
  return `${SIZE_LABEL[size]} ${direction}`;
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

export interface NoteAccuracy {
  /** The last 7 days, today included; null when nothing was finished in them. */
  week: Score | null;
  /** The 7 days before those. */
  before: Score | null;
  all: Score | null;
  /** `week` minus `before`, in percentage points; null unless both have data. */
  delta: number | null;
  /** One point per practice day, oldest first (the latest 14). */
  byDay: { day: string; pct: number; notes: number }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 14;

/** Whole local days from `t`'s day to `now`'s day. */
function daysAgo(t: Date, now: Date): number {
  const noon = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime();
  return Math.round((noon(now) - noon(t)) / DAY_MS);
}

/** Share of notes matched: lately, the week before, ever, and per practice day. */
export function noteAccuracy(attempts: readonly Attempt[], now: Date): NoteAccuracy {
  const scored = scoredAttempts(attempts);
  const score = (of: readonly Attempt[]) =>
    of.length === 0 ? null : scoreOf(of.flatMap((a) => a.noteResults));
  const within = (from: number, to: number) =>
    scored.filter((a) => {
      const ago = daysAgo(new Date(a.createdAt), now);
      return ago >= from && ago <= to;
    });

  const week = score(within(0, 6));
  const before = score(within(7, 13));

  const days = new Map<string, Attempt[]>();
  for (const a of scored) {
    const key = dayKey(new Date(a.createdAt));
    days.set(key, [...(days.get(key) ?? []), a]);
  }
  const byDay = [...days.entries()]
    .sort(([x], [y]) => x.localeCompare(y))
    .slice(-TREND_DAYS)
    .map(([day, of]) => {
      const s = score(of)!;
      return { day, pct: s.pct, notes: s.notes };
    });

  return {
    week,
    before,
    all: score(scored),
    delta: week && before ? week.pct - before.pct : null,
    byDay,
  };
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

const share = (part: number, whole: number) => Math.round((part / whole) * 100);

/**
 * Plain sentences about how the wrong notes go — a lean above or below, misses that are close, octave
 * slips, and whether the direction of the move is heard. Only patterns that are clearly there are
 * stated, and none until there are enough wrong notes to see one.
 */
export function missPatterns(events: readonly NoteEvent[], minMisses = MIN_MISSES): string[] {
  const wrong = events.filter(
    (e): e is NoteEvent & { played: number } => e.played !== null && !e.hit,
  );
  if (wrong.length < minMisses) return [];
  const out: string[] = [];

  const high = share(wrong.filter((e) => e.played > e.expected).length, wrong.length);
  if (high >= 65) {
    out.push(`You tend to land too high: ${high}% of your wrong notes are above the right one.`);
  } else if (100 - high >= 65) {
    out.push(
      `You tend to land too low: ${100 - high}% of your wrong notes are below the right one.`,
    );
  }

  const close = share(
    wrong.filter((e) => Math.abs(e.played - e.expected) <= 2).length,
    wrong.length,
  );
  if (close >= 50) {
    out.push(`Your misses are close: ${close}% are within a tone of the right note.`);
  }

  const octave = share(wrong.filter((e) => e.octave).length, wrong.length);
  if (octave >= 15) {
    out.push(`${octave}% of your wrong notes are the right note in the wrong octave.`);
  }

  // Direction: only where the tune moves, and there is a note to move from.
  const moved = wrong.filter(
    (e): e is NoteEvent & { played: number; prev: number } =>
      e.prev !== null && e.expected !== e.prev,
  );
  if (moved.length >= Math.ceil(minMisses / 2)) {
    const rightWay = share(
      moved.filter((e) => Math.sign(e.played - e.prev) === Math.sign(e.expected - e.prev)).length,
      moved.length,
    );
    if (rightWay >= 60) {
      out.push(
        `You hear which way the melody moves: ${rightWay}% of your wrong notes go the right way and stop on the wrong note.`,
      );
    } else if (rightWay <= 40) {
      out.push(
        `Listen for the direction first: ${100 - rightWay}% of your wrong notes move the wrong way.`,
      );
    }
  }
  return out;
}
