// Pure playback-scheduling math (contracts/audio-playback.md): turn a target Melody + tempo into
// per-note start times/durations. Isolated from expo-av so it is unit-testable.
import { Melody } from '../models';

export interface ScheduledNote {
  midi: number;
  startMs: number;
  durationMs: number;
}

export interface PlaybackMelody {
  notes: ScheduledNote[];
}

/** Milliseconds per beat for a tempo in BPM. */
export function beatMs(tempoBpm: number): number {
  return 60000 / tempoBpm;
}

/**
 * Schedule a melody's notes back-to-back by their beat durations at the given tempo.
 * Deterministic: the same melody + tempo always yields identical timing (US1 scenario 4).
 */
export function scheduleMelody(melody: Melody, tempoBpm: number): PlaybackMelody {
  const perBeat = beatMs(tempoBpm);
  let cursor = 0;
  const notes: ScheduledNote[] = melody.notes.map((n) => {
    const durationMs = n.durationBeats * perBeat;
    const scheduled: ScheduledNote = { midi: n.midi, startMs: cursor, durationMs };
    cursor += durationMs;
    return scheduled;
  });
  return { notes };
}

/** Total play time of a scheduled melody in ms. */
export function totalDurationMs(m: PlaybackMelody): number {
  if (m.notes.length === 0) {
    return 0;
  }
  const last = m.notes[m.notes.length - 1];
  return last.startMs + last.durationMs;
}
