// The note row under the fretboard (spec 021): one circle per note of the phrase, left to right.
// Pure maths — where each note starts, which circles have sounded, which circle a touch is nearest to — so
// the component stays a thin shell and all of it is unit-testable.
//
// Time here is "media" time: milliseconds into the phrase at the tune's own tempo (what MediaClock and a
// clip's `fromMs` use), whatever speed it is played at.
import { Melody } from '../models';
import { scheduleMelody, totalDurationMs } from './schedule';

/** A pause this close to the end of a phrase counts as finished: resuming would sound nothing. */
export const END_MS = 300;

export const CIRCLE_MAX = 22;
/** Smallest circle: at 17 notes (the longest library phrase) a 228 dp row spaces circles 13.4 dp apart, so 10 never overlaps. */
export const CIRCLE_MIN = 10;
/** A circle this big or bigger has room for a note name ("C#4" at 8 dp type); smaller ones stay blank. */
export const NAME_MIN = 14;

export interface NoteTimeline {
  /** Media start of every note, ms. */
  starts: number[];
  /** Media length of the whole phrase, ms. */
  totalMs: number;
}

/** Where each note of `m` starts at the tune's own tempo, and how long the whole of it is. */
export function noteTimeline(m: Melody): NoteTimeline {
  const scheduled = scheduleMelody(m, m.tempoBpm);
  return { starts: scheduled.notes.map((n) => n.startMs), totalMs: totalDurationMs(scheduled) };
}

/** A paused place is worth keeping only if there is something left to play after it. */
export function resumable(positionMs: number, totalMs: number): boolean {
  return Number.isFinite(positionMs) && positionMs >= 0 && totalMs - positionMs > END_MS;
}

export interface RowState {
  /** Notes already sounded (they fill). */
  played: number;
  /** The note sounding now, or -1 when none is (nothing playing, or the end has passed). */
  current: number;
}

/** Which circles have sounded at `positionMs`; null (nothing playing) leaves them all empty. */
export function rowState(
  positionMs: number | null,
  starts: readonly number[],
  totalMs: number,
): RowState {
  if (positionMs === null || starts.length === 0) return { played: 0, current: -1 };
  if (positionMs >= totalMs) return { played: starts.length, current: -1 };
  let current = 0;
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] <= positionMs) current = i;
  }
  return { played: current, current };
}

/** Circle diameter for `count` circles along a row `width` wide: as big as fits, within CIRCLE_MIN..CIRCLE_MAX. */
export function circleSize(count: number, width: number): number {
  if (count <= 0 || width <= 0) return CIRCLE_MAX;
  return Math.max(CIRCLE_MIN, Math.min(CIRCLE_MAX, Math.floor(width / count) - 4));
}

/** Horizontal centre of each circle: evenly spaced, the first and last a radius in from the ends. */
export function circleCenters(count: number, width: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [width / 2];
  const r = circleSize(count, width) / 2;
  const step = (width - 2 * r) / (count - 1);
  return Array.from({ length: count }, (_, i) => r + i * step);
}

/** The circle nearest to a touch `x` dp along a row `width` wide; a touch beyond either end clamps to it. */
export function noteAtOffset(x: number, width: number, count: number): number {
  if (count <= 1 || width <= 0) return 0;
  const r = circleSize(count, width) / 2;
  const step = (width - 2 * r) / (count - 1);
  return Math.min(count - 1, Math.max(0, Math.round((x - r) / step)));
}
