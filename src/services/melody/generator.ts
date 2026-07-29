// Melody generator (FR-001): pure, deterministic given a seed. Produces a monophonic sequence
// within the level's range and scale, never repeating a pitch back-to-back (see FR-004).
//
// Phase 0 musicality: rather than picking each note uniformly, the generator biases toward
// stepwise motion (weighted intervals), fills in after a leap with a step in the opposite
// direction (gap-fill), and shapes a cadence — it opens on a triad tone and closes on the tonic
// approached from a neighbour. These only reshape the *distribution* of picks; every invariant the
// tests rely on (deterministic per seed, exactly noteCount notes, in range/scale, no consecutive
// repeats) is preserved, and exactly one RNG draw is consumed per note.
import { DifficultyLevel, Melody, Note } from '../../models';
import { hzFromMidi, isInGuitarRange, noteName, pitchClass } from '../../lib/pitchNote';
import { scalePitchClasses } from './scales';

/** Fixed placeholder; the storage layer stamps the real creation time on persist. */
const CREATED_AT_PLACEHOLDER = new Date(0).toISOString();

/** Semitone distances from the tonic that read as chord tones (root, 3rd, 5th, major/minor 3rd). */
const TRIAD_DISTANCES = new Set([0, 3, 4, 7]);
/** Semitone distances from the tonic that neighbour it (supertonic / leading-tone side). */
const NEIGHBOUR_DISTANCES = new Set([1, 2, 10, 11]);

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

/** Candidate MIDI notes within [low, high] whose pitch class belongs to the scale (ascending). */
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
 * Relative desirability of a melodic interval: steps (≤ a whole tone) are strongly preferred,
 * thirds are common, fourths/fifths occasional, wider leaps rare. Never called with delta 0.
 */
function intervalWeight(delta: number): number {
  if (delta <= 2) return 8;
  if (delta <= 4) return 5;
  if (delta <= 7) return 2;
  return 0.5;
}

/** Draw one item from `items` in proportion to `weights`, consuming exactly one RNG value. */
function weightedDraw(items: number[], weights: number[], rand: () => number): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * Pick the next pitch from `pool`, never repeating `prev`, weighting smaller intervals higher.
 * When `dir` is set (gap-fill), notes moving that way are preferred but the constraint is relaxed
 * before it would leave nothing to choose. Falls back to the full candidate set for an empty pool.
 */
function pickNext(
  pool: number[],
  prev: number | null,
  candidates: number[],
  rand: () => number,
  dir?: number,
): number {
  let eligible = pool.filter((m) => m !== prev);
  if (dir !== undefined && prev !== null) {
    const directed = eligible.filter((m) => Math.sign(m - prev) === dir);
    if (directed.length > 0) eligible = directed;
  }
  if (eligible.length === 0) {
    eligible = candidates.filter((m) => m !== prev);
  }
  const weights = eligible.map((m) => (prev === null ? 1 : intervalWeight(Math.abs(m - prev))));
  return weightedDraw(eligible, weights, rand);
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

  // Cadence pools, derived from the scale's tonic. Empty pools (e.g. an exotic range) fall back to
  // the full candidate set inside pickNext, so generation stays robust for arbitrary levels.
  const tonicPc = scalePitchClasses(level.scale)[0];
  const distFromTonic = (midi: number) => (((pitchClass(midi) - tonicPc) % 12) + 12) % 12;
  const tonicPool = candidates.filter((m) => distFromTonic(m) === 0);
  const triadPool = candidates.filter((m) => TRIAD_DISTANCES.has(distFromTonic(m)));
  const neighbourPool = candidates.filter((m) => NEIGHBOUR_DISTANCES.has(distFromTonic(m)));

  const rand = mulberry32(seed);
  const n = level.noteCount;
  const midis: number[] = [];
  let lastDelta = 0; // signed interval of the previous move; 0 until the first move is made

  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? midis[i - 1] : null;
    // After a leap (> a third), pull back with a step the other way — classic gap-fill.
    const dir = prev !== null && Math.abs(lastDelta) > 4 ? -Math.sign(lastDelta) : undefined;

    let chosen: number;
    if (i === 0) {
      // Open on a chord tone so the phrase has a clear tonal anchor.
      chosen = pickNext(triadPool.length ? triadPool : candidates, null, candidates, rand);
    } else if (i === n - 1) {
      // Land on the tonic — the sense of a finished phrase.
      chosen = pickNext(tonicPool.length ? tonicPool : candidates, prev, candidates, rand, dir);
    } else if (i === n - 2) {
      // Approach the tonic from a neighbour (II→I or VII→I).
      chosen = pickNext(
        neighbourPool.length ? neighbourPool : candidates,
        prev,
        candidates,
        rand,
        dir,
      );
    } else {
      chosen = pickNext(candidates, prev, candidates, rand, dir);
    }

    if (prev !== null) lastDelta = chosen - prev;
    midis.push(chosen);
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
