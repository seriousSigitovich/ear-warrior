// Melody generator (FR-001): pure, deterministic given a seed. Builds a phrase top-down instead of
// picking each note from the previous one, because a note-by-note walk is what made phrases sound
// like mush — no rhythm to group notes, no repetition to hold on to, no tonal frame to hear against.
//
// Layers, in the order they are decided:
//   1. Key     — a tonic and scale family per melody (the level only fixes the family options).
//   2. Rhythm  — note durations from a small cell vocabulary; the phrase ends on a long note.
//   3. Motif   — the opening motif is repeated / sequenced / varied in the second half (level.motif),
//                which is what makes a phrase memorable. `none` is a free phrase — the hardest.
//   4. Pitches — a weighted walk: small intervals preferred, chord tones on strong beats, gap-fill
//                after a leap, an arch contour; the phrase lands on the tonic.
//
// Candidates are generated and checked against the level's hard constraints (in scale & register,
// no consecutive repeats, every interval ≤ maxLeap, span ≤ maxSpan, ≥ 3 distinct pitches from 4
// notes up, ends on the tonic); a rejected
// candidate is regenerated from the same RNG stream, so the result stays deterministic per seed.
// Consecutive repeats stay banned because the segmenter can't yet split a re-plucked pitch (FR-004).
import { DifficultyLevel, Melody, Note, ScaleFamily } from '../../models';
import { hzFromMidi, isInGuitarRange, noteName, pitchClass } from '../../lib/pitchNote';
import { scalePitchClasses } from './scales';

/** Fixed placeholder; the storage layer stamps the real creation time on persist. */
const CREATED_AT_PLACEHOLDER = new Date(0).toISOString();

export const MIN_NOTES = 2;
export const MAX_NOTES = 12;

/** Guitar-friendly keys per family, as tonic pitch classes. */
const TONICS: Record<ScaleFamily, number[]> = {
  major_pentatonic: [0, 7, 2, 9, 4, 5], // C G D A E F
  major: [0, 7, 2, 9, 4, 5],
  natural_minor: [9, 4, 2, 11, 7], // A E D B G
};
/** Tonic spelling used in `Melody.scale` (parsed back by scalePitchClasses). */
const TONIC_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
/** The tonic is placed in G3–F#4, leaving room for the phrase to move above and below it. */
const TONIC_LOW_MIDI = 55;

/** Rhythm cells in beats; a cell contributes one note per entry. */
const RHYTHM_CELLS: number[][] = [[1], [1], [0.5, 0.5], [2], [1.5, 0.5]];
/** The phrase-final note is held so the ending reads as an ending. */
const FINAL_BEATS = 2;

/** Below this a motif is ≤ 2 notes, and repeating it just see-saws — such phrases are walked freely. */
const MIN_MOTIF_NOTES = 6;

/** Candidates tried before falling back to a guaranteed-valid neighbour pattern. */
const MAX_TRIES = 400;

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

function pick<T>(items: T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length)];
}

/** Draw one item in proportion to `weights`; null when nothing has positive weight. */
function weightedDraw(items: number[], weights: number[], rand: () => number): number | null {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (items.length === 0 || total <= 0) return null;
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

/** Everything a single melody's pitch choices are made against. */
interface Frame {
  tonic: number;
  /** Scale notes inside the register, ascending — index distance is scale-degree distance. */
  pool: number[];
  /** Pitch classes of the tonic triad. */
  chordPcs: Set<number>;
  maxLeap: number;
}

function buildFrame(level: DifficultyLevel, family: ScaleFamily, tonicPc: number): Frame {
  const tonic = TONIC_LOW_MIDI + ((((tonicPc - TONIC_LOW_MIDI) % 12) + 12) % 12);
  const pcs = new Set(scalePitchClasses(`${TONIC_NAMES[tonicPc]}_${family}`));
  const pool: number[] = [];
  for (let midi = level.rangeLowMidi; midi <= level.rangeHighMidi; midi++) {
    if (pcs.has(pitchClass(midi)) && isInGuitarRange(midi)) pool.push(midi);
  }
  const third = family === 'natural_minor' ? 3 : 4;
  return {
    tonic,
    pool,
    chordPcs: new Set([tonicPc, pitchClass(tonicPc + third), pitchClass(tonicPc + 7)]),
    maxLeap: level.maxLeap,
  };
}

/** Relative desirability of an interval: steps strongly preferred, wide leaps rare. */
function intervalWeight(semitones: number): number {
  if (semitones <= 2) return 8;
  if (semitones <= 4) return 5;
  if (semitones <= 7) return 2;
  return 0.6;
}

/** Durations for `count` notes built from rhythm cells, in beats. */
function rhythmFor(count: number, rand: () => number): number[] {
  const out: number[] = [];
  while (out.length < count) {
    const fits = RHYTHM_CELLS.filter((c) => c.length <= count - out.length);
    out.push(...pick(fits, rand));
  }
  return out;
}

/** Beat-1 and beat-3 onsets in 4/4 carry the harmony; chord tones belong there. */
function strongBeats(durations: number[]): boolean[] {
  let beat = 0;
  return durations.map((d) => {
    const strong = beat % 2 === 0;
    beat += d;
    return strong;
  });
}

/** An opening note: a chord tone in the octave above the tonic. */
function openingPitch(frame: Frame, rand: () => number): number | null {
  const options = frame.pool.filter(
    (m) => m >= frame.tonic && m <= frame.tonic + 7 && frame.chordPcs.has(pitchClass(m)),
  );
  return options.length ? pick(options, rand) : null;
}

/**
 * One step of the walk. `progress` (0–1) drives the arch: rise through the first half, fall after.
 * `lastDelta` drives gap-fill: after a leap wider than a third, turn back.
 */
function nextPitch(
  frame: Frame,
  prev: number,
  lastDelta: number,
  strong: boolean,
  progress: number,
  rand: () => number,
): number | null {
  const options = frame.pool.filter((m) => m !== prev && Math.abs(m - prev) <= frame.maxLeap);
  const weights = options.map((m) => {
    const delta = m - prev;
    let w = intervalWeight(Math.abs(delta));
    if (strong && frame.chordPcs.has(pitchClass(m))) w *= 2.5;
    if (Math.abs(lastDelta) > 4 && Math.sign(delta) === -Math.sign(lastDelta)) w *= 3;
    if (Math.sign(delta) === (progress < 0.5 ? 1 : -1)) w *= 1.5;
    return w;
  });
  return weightedDraw(options, weights, rand);
}

/** The tonic nearest `prev` that is a legal move from it. */
function cadenceTonic(frame: Frame, prev: number): number | null {
  const tonicPc = pitchClass(frame.tonic);
  const options = frame.pool
    .filter((m) => pitchClass(m) === tonicPc && m !== prev && Math.abs(m - prev) <= frame.maxLeap)
    .sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev));
  return options.length ? options[0] : null;
}

/** Free walk of `count` pitches starting from `first`. */
function walk(
  frame: Frame,
  first: number,
  count: number,
  strong: boolean[],
  rand: () => number,
): number[] | null {
  const out = [first];
  let lastDelta = 0;
  for (let i = 1; i < count; i++) {
    const prev = out[i - 1];
    const next = nextPitch(frame, prev, lastDelta, strong[i], i / count, rand);
    if (next === null) return null;
    lastDelta = next - prev;
    out.push(next);
  }
  return out;
}

/** Shift every pitch by `steps` scale degrees; null if any note leaves the pool. */
function shiftDegrees(frame: Frame, pitches: number[], steps: number): number[] | null {
  const out: number[] = [];
  for (const m of pitches) {
    const shifted = frame.pool[frame.pool.indexOf(m) + steps];
    if (shifted === undefined) return null;
    out.push(shifted);
  }
  return out;
}

interface Draft {
  pitches: number[];
  durations: number[];
}

/** A phrase with no motif structure: walk, then land on the tonic. */
function freePhrase(frame: Frame, n: number, rand: () => number): Draft | null {
  const durations = [...rhythmFor(n - 1, rand), FINAL_BEATS];
  const first = openingPitch(frame, rand);
  if (first === null) return null;
  const body = walk(frame, first, n - 1, strongBeats(durations), rand);
  if (body === null) return null;
  const last = cadenceTonic(frame, body[body.length - 1]);
  if (last === null) return null;
  return { pitches: [...body, last], durations };
}

/**
 * Antecedent → consequent: motif A (⌊n/2⌋ notes), then A transformed per `level.motif`, closing on
 * the tonic. The consequent reuses A's rhythm too, so the repetition is audible even when the
 * pitches are sequenced or varied.
 */
function motifPhrase(
  level: DifficultyLevel,
  frame: Frame,
  n: number,
  rand: () => number,
): Draft | null {
  const k = Math.floor(n / 2);
  const rhythmA = rhythmFor(k, rand);
  const first = openingPitch(frame, rand);
  if (first === null) return null;
  const a = walk(frame, first, k, strongBeats(rhythmA), rand);
  // An antecedent that already lands on the tonic sounds finished; keep it open.
  if (a === null || pitchClass(a[k - 1]) === pitchClass(frame.tonic)) return null;

  let b: number[] | null = [...a];
  if (level.motif === 'sequence') {
    b = shiftDegrees(frame, a, rand() < 0.5 ? 1 : -1);
  } else if (level.motif === 'variation' && k >= 2) {
    const j = 1 + Math.floor(rand() * (k - 1));
    const moved = shiftDegrees(frame, [a[j]], rand() < 0.5 ? 1 : -1);
    if (moved === null) return null;
    b[j] = moved[0];
  }
  if (b === null) return null;

  // Consequent length is k (last motif note becomes the cadence) or k + 1 (cadence appended).
  let rhythmB: number[];
  if (n - k === k) {
    b = b.slice(0, k - 1);
    rhythmB = [...rhythmA.slice(0, k - 1), FINAL_BEATS];
  } else {
    rhythmB = [...rhythmA, FINAL_BEATS];
  }
  const beforeCadence = b.length ? b[b.length - 1] : a[a.length - 1];
  const last = cadenceTonic(frame, beforeCadence);
  if (last === null) return null;
  return { pitches: [...a, ...b, last], durations: [...rhythmA, ...rhythmB] };
}

function isValid(level: DifficultyLevel, frame: Frame, d: Draft): boolean {
  const p = d.pitches;
  if (p.length !== level.noteCount || d.durations.length !== p.length) return false;
  if (!p.every((m) => frame.pool.includes(m))) return false;
  for (let i = 1; i < p.length; i++) {
    if (p[i] === p[i - 1] || Math.abs(p[i] - p[i - 1]) > level.maxLeap) return false;
  }
  if (Math.max(...p) - Math.min(...p) > level.maxSpan) return false;
  // Two pitches see-sawing is not a melody; from 4 notes up, require at least a third pitch.
  if (p.length >= 4 && new Set(p).size < 3) return false;
  return pitchClass(p[p.length - 1]) === pitchClass(frame.tonic);
}

/** Guaranteed-valid last resort: alternate the tonic with its upper neighbour, ending on the tonic. */
function fallback(level: DifficultyLevel, frame: Frame): Draft {
  const i = frame.pool.indexOf(frame.tonic);
  const upper = frame.pool[i + 1];
  if (i < 0 || upper === undefined || upper - frame.tonic > level.maxLeap) {
    throw new Error(
      `Level ${level.id} cannot produce a valid melody (register or maxLeap too small).`,
    );
  }
  const n = level.noteCount;
  const pitches = Array.from({ length: n }, (_, idx) =>
    (n - 1 - idx) % 2 === 0 ? frame.tonic : upper,
  );
  return { pitches, durations: [...new Array<number>(n - 1).fill(1), FINAL_BEATS] };
}

/**
 * Generate a target melody for a difficulty level. Deterministic for a given `seed`.
 * @throws if the level is invalid or cannot yield a valid phrase.
 */
export function generateMelody(level: DifficultyLevel, seed: number): Melody {
  const n = level.noteCount;
  if (!Number.isInteger(n) || n < MIN_NOTES || n > MAX_NOTES) {
    throw new Error(`Invalid noteCount ${n}; expected an integer in ${MIN_NOTES}–${MAX_NOTES}.`);
  }
  if (level.rangeLowMidi > level.rangeHighMidi) {
    throw new Error('Invalid range: rangeLowMidi > rangeHighMidi.');
  }
  if (level.scales.length === 0) {
    throw new Error(`Level ${level.id} has no scale families.`);
  }

  const rand = mulberry32(seed);
  const family = pick(level.scales, rand);
  const tonicPc = pick(TONICS[family], rand);
  const frame = buildFrame(level, family, tonicPc);
  if (!frame.pool.includes(frame.tonic)) {
    throw new Error(
      `Level ${level.id}: register ${level.rangeLowMidi}–${level.rangeHighMidi} excludes the tonic.`,
    );
  }

  let draft: Draft | null = null;
  for (let t = 0; t < MAX_TRIES && draft === null; t++) {
    const candidate =
      level.motif === 'none' || n < MIN_MOTIF_NOTES
        ? freePhrase(frame, n, rand)
        : motifPhrase(level, frame, n, rand);
    if (candidate && isValid(level, frame, candidate)) draft = candidate;
  }
  const final = draft ?? fallback(level, frame);

  const notes: Note[] = final.pitches.map((midi, index) => ({
    index,
    midi,
    noteName: noteName(midi),
    frequencyHz: hzFromMidi(midi),
    centsOffset: 0,
    durationBeats: final.durations[index],
  }));

  return {
    id: `${level.id}-${seed}`,
    notes,
    difficultyId: level.id,
    scale: `${TONIC_NAMES[tonicPc]}_${family}`,
    createdAt: CREATED_AT_PLACEHOLDER,
  };
}
