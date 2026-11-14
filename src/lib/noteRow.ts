// The note track under the fretboard (spec 021): one mark per note of the phrase along a line, left to right,
// with a handle at the playing position. Pure maths — where each note starts, which marks have sounded, where
// the handle sits, which mark a touch is nearest to — so the component stays a thin shell and all of it is
// unit-testable.
//
// Time here is "media" time: milliseconds into the phrase at the tune's own tempo (what MediaClock and a
// clip's `fromMs` use), whatever speed it is played at.
import { Melody } from '../models';
import { scheduleMelody, totalDurationMs } from './schedule';

/** A pause this close to the end of a phrase counts as finished: resuming would sound nothing. */
export const END_MS = 300;

/** Half the handle's width: the first and last marks sit this far in from the ends of the track. */
export const TRACK_PAD = 8;
/** A note name ("C#") needs this much room between neighbouring marks; closer than that, names are left out. */
export const NAME_STEP_MIN = 14;

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

/** Which marks have sounded at `positionMs`; null (nothing playing) leaves them all empty. */
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

/** Horizontal centre of each mark: evenly spaced from `pad` to `width - pad`; a single mark sits in the middle. */
export function markCenters(count: number, width: number, pad = TRACK_PAD): number[] {
  if (count <= 0) return [];
  if (count === 1) return [width / 2];
  const step = (width - 2 * pad) / (count - 1);
  return Array.from({ length: count }, (_, i) => pad + i * step);
}

/** Room between neighbouring marks, dp (0 for fewer than two). */
export function markStep(count: number, width: number, pad = TRACK_PAD): number {
  return count < 2 ? 0 : (width - 2 * pad) / (count - 1);
}

/** Whether the marks are far enough apart for note names above them. */
export function showsNames(count: number, width: number, pad = TRACK_PAD): boolean {
  return markStep(count, width, pad) >= NAME_STEP_MIN;
}

/** The mark nearest to a touch `x` dp along a track `width` wide; a touch beyond either end clamps to it. */
export function noteAtOffset(x: number, width: number, count: number, pad = TRACK_PAD): number {
  if (count <= 1 || width <= 0) return 0;
  const step = markStep(count, width, pad);
  return Math.min(count - 1, Math.max(0, Math.round((x - pad) / step)));
}

/**
 * Where the handle sits, dp along the track: on a mark at the start of its note and sliding to the next as
 * the note plays, so it moves smoothly instead of hopping. Null (nothing playing) gives null.
 */
export function handleX(
  positionMs: number | null,
  starts: readonly number[],
  totalMs: number,
  width: number,
  pad = TRACK_PAD,
): number | null {
  if (positionMs === null || starts.length === 0) return null;
  const centers = markCenters(starts.length, width, pad);
  if (positionMs >= totalMs) return centers[centers.length - 1];
  const { current } = rowState(positionMs, starts, totalMs);
  if (current >= starts.length - 1) return centers[current];
  const span = starts[current + 1] - starts[current];
  const t = span > 0 ? Math.min(1, Math.max(0, (positionMs - starts[current]) / span)) : 0;
  return centers[current] + t * (centers[current + 1] - centers[current]);
}
