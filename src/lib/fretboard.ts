// Fretboard model for tap-to-answer input. Pure and deterministic — no IO, no React Native.
//
// The learner answers a melody by tapping frets. A tap is a (string, fret) position, but grading is by pitch (MIDI), so the same sound on a different string
// is the same answer — the exercise tests the ear, not knowledge of one fingering. Taps are
// converted to `DetectedNote[]`, the shape the grading engine, adaptation, persistence and sync consume.
import { DetectedNote, NoteResult, NoteStatus } from '../models';
import { hzFromMidi } from './pitchNote';

/** Open-string pitches in standard tuning, ordered low E → high e (string 0 is the lowest). */
export const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64] as const;
/** Display names for the strings, same order as `OPEN_STRING_MIDI`. */
export const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'] as const;

export const STRING_COUNT = OPEN_STRING_MIDI.length;
/** Fret positions per string: open (0) plus frets 1–12, so the high e tops out at E5 (MIDI 76). */
export const FRET_COUNT = 13;
export const MAX_FRET = FRET_COUNT - 1;

/** Frets carrying a single inlay dot, and the one carrying a double dot. */
export const SINGLE_INLAY_FRETS: readonly number[] = [3, 5, 7, 9];
export const DOUBLE_INLAY_FRET = 12;

/** A place on the neck. `string` 0 is the low E; `fret` 0 is the open string. */
export interface FretPosition {
  string: number;
  fret: number;
}

/** One tap on the fretboard, stamped with the pitch it sounds and when it happened. */
export interface FretTap extends FretPosition {
  midi: number;
  /** Wall-clock ms; only the spacing between taps matters. */
  atMs: number;
}

export function isValidPosition(p: FretPosition): boolean {
  return (
    Number.isInteger(p.string) &&
    Number.isInteger(p.fret) &&
    p.string >= 0 &&
    p.string < STRING_COUNT &&
    p.fret >= 0 &&
    p.fret <= MAX_FRET
  );
}

/** MIDI pitch sounded at a fretboard position. */
export function fretMidi(p: FretPosition): number {
  if (!isValidPosition(p)) {
    throw new Error(`Invalid fretboard position: string ${p.string}, fret ${p.fret}.`);
  }
  return OPEN_STRING_MIDI[p.string] + p.fret;
}

/** Every position that sounds `midi`, low string first. Empty when the pitch is off the board. */
export function positionsForMidi(midi: number): FretPosition[] {
  const out: FretPosition[] = [];
  for (let string = 0; string < STRING_COUNT; string++) {
    const fret = midi - OPEN_STRING_MIDI[string];
    if (fret >= 0 && fret <= MAX_FRET) out.push({ string, fret });
  }
  return out;
}

export function makeTap(p: FretPosition, atMs: number): FretTap {
  return { string: p.string, fret: p.fret, midi: fretMidi(p), atMs };
}

/**
 * Append a tap, unless the answer already holds `capacity` notes (the melody's length). Returns the
 * same array when full so a caller can tell nothing was added.
 */
export function addTap(taps: FretTap[], tap: FretTap, capacity: number): FretTap[] {
  return taps.length >= capacity ? taps : [...taps, tap];
}

/** Drop the most recent tap. */
export function undoTap(taps: FretTap[]): FretTap[] {
  return taps.slice(0, -1);
}

/** How long a tapped note is considered to sound when no later tap ends it. */
const LAST_NOTE_MS = 500;

/**
 * Express an answer as detected notes: exact pitch, zero cents offset, full clarity. Times are
 * relative to the first tap.
 */
export function tapsToDetected(taps: FretTap[]): DetectedNote[] {
  if (taps.length === 0) return [];
  const t0 = taps[0].atMs;
  return taps.map((tap, i) => {
    const startMs = tap.atMs - t0;
    const next = taps[i + 1];
    return {
      index: i,
      midi: tap.midi,
      frequencyHz: hzFromMidi(tap.midi),
      centsOffset: 0,
      clarity: 1,
      startMs,
      endMs: next ? next.atMs - t0 : startMs + LAST_NOTE_MS,
    };
  });
}

/**
 * Grade status of each tap, in tap order. The grader returns one result per target note plus one per
 * `extra`; every result except `missed` consumes exactly one played note, in order, so dropping the
 * missed ones leaves a list aligned with the taps.
 */
export function tapStatuses(results: NoteResult[]): NoteStatus[] {
  return results.filter((r) => r.status !== 'missed').map((r) => r.status);
}
