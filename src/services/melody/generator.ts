// Melody generator (FR-001): pure, deterministic given a seed. Produces a monophonic sequence
// within the level's range and scale, never repeating a pitch back-to-back (see FR-004).
import { DifficultyLevel, Melody, Note } from '../../models';
import { hzFromMidi, isInGuitarRange, noteName, pitchClass } from '../../lib/pitchNote';
import { scalePitchClasses } from './scales';

/** Fixed placeholder; the storage layer stamps the real creation time on persist. */
const CREATED_AT_PLACEHOLDER = new Date(0).toISOString();

/** Deterministic 32-bit PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Candidate MIDI notes within [low, high] whose pitch class belongs to the scale. */
function candidatePitches(level: DifficultyLevel): number[] {
  const pcs = new Set(scalePitchClasses(level.scale));
  const out: number[] = [];
  for (let midi = level.rangeLowMidi; midi <= level.rangeHighMidi; midi++) {
    if (pcs.has(pitchClass(midi)) && isInGuitarRange(midi)) {
      out.push(midi);
    }
  }
  return out;
}

/**
 * Generate a target melody for a difficulty level. Deterministic for a given `seed`.
 * @throws if the level is invalid (noteCount out of 2–8) or the range/scale yields < 2 distinct pitches.
 */
export function generateMelody(level: DifficultyLevel, seed: number): Melody {
  if (!Number.isInteger(level.noteCount) || level.noteCount < 2 || level.noteCount > 8) {
    throw new Error(`Invalid noteCount ${level.noteCount}; expected an integer in 2–8 (SC-005).`);
  }
  if (level.rangeLowMidi > level.rangeHighMidi) {
    throw new Error('Invalid range: rangeLowMidi > rangeHighMidi.');
  }

  const candidates = candidatePitches(level);
  if (candidates.length < 2) {
    throw new Error(
      `Range/scale yields ${candidates.length} usable pitch(es); need ≥ 2 to avoid consecutive repeats.`,
    );
  }

  const rand = mulberry32(seed);
  const midis: number[] = [];
  for (let i = 0; i < level.noteCount; i++) {
    let pick = candidates[Math.floor(rand() * candidates.length)];
    // Enforce "no two identical pitches consecutively" (FR-001).
    while (i > 0 && pick === midis[i - 1]) {
      pick = candidates[Math.floor(rand() * candidates.length)];
    }
    midis.push(pick);
  }

  const notes: Note[] = midis.map((midi, index) => ({
    index,
    midi,
    noteName: noteName(midi),
    frequencyHz: hzFromMidi(midi),
    centsOffset: 0,
    durationBeats: 1,
  }));

  return {
    id: `${level.id}-${seed}`,
    notes,
    difficultyId: level.id,
    scale: level.scale,
    createdAt: CREATED_AT_PLACEHOLDER,
  };
}
