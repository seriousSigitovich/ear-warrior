// Help for a learner who is stuck: where on the neck a melody can be played, which way the first
// wrong note is off, and when to offer a way out of a phrase that keeps failing. Pure.
import { AttemptGrade } from '../models';
import { FretPosition, MAX_FRET, OPEN_STRING_MIDI, positionsForMidi } from './fretboard';

/**
 * Failed checks on one phrase after which help is offered (a hint, the answer or an easier tune).
 * Retries never move the rank (FR-011a), so without this a learner can hit the same wall forever.
 */
export const HELP_AFTER_FAILS = 3;

export function shouldOfferHelp(failsOnPhrase: number): boolean {
  return failsOnPhrase >= HELP_AFTER_FAILS;
}

/** Moving across a string costs more than sliding a fret: a hand-friendly line stays on few strings. */
const STRING_MOVE_COST = 1.5;
/** Low frets are easier to find for a beginner, so among equal lines the one nearer the nut wins. */
const FRET_HEIGHT_COST = 0.1;

/**
 * One playable position per note: the line through the notes with the least hand movement.
 * Notes off the board are skipped (the library never has them).
 */
export function fingering(midis: readonly number[]): FretPosition[] {
  const options = midis.map(positionsForMidi).filter((ps) => ps.length > 0);
  if (options.length === 0) return [];
  // Viterbi over the positions of each note.
  let costs = options[0].map((p) => p.fret * FRET_HEIGHT_COST);
  const back: number[][] = [];
  for (let i = 1; i < options.length; i++) {
    const prev = options[i - 1];
    const step = options[i].map((p) => {
      let best = 0;
      let bestCost = Infinity;
      prev.forEach((q, j) => {
        const c =
          costs[j] +
          Math.abs(p.fret - q.fret) +
          STRING_MOVE_COST * Math.abs(p.string - q.string) +
          p.fret * FRET_HEIGHT_COST;
        if (c < bestCost) {
          bestCost = c;
          best = j;
        }
      });
      return { best, bestCost };
    });
    back.push(step.map((s) => s.best));
    costs = step.map((s) => s.bestCost);
  }
  let k = costs.indexOf(Math.min(...costs));
  const line: FretPosition[] = [options[options.length - 1][k]];
  for (let i = options.length - 1; i > 0; i--) {
    k = back[i - 1][k];
    line.unshift(options[i - 1][k]);
  }
  return line;
}

/**
 * The whole phrase on one string, every note on a fret (no open strings: a beginner reads "tap above
 * the nut" as off the neck), as close to the nut as it fits. Null when no string holds every note.
 */
export function oneStringFingering(midis: readonly number[]): FretPosition[] | null {
  let best: FretPosition[] | null = null;
  for (let string = 0; string < OPEN_STRING_MIDI.length; string++) {
    const frets = midis.map((m) => m - OPEN_STRING_MIDI[string]);
    if (frets.length === 0 || frets.some((f) => f < 1 || f > MAX_FRET)) continue;
    if (!best || Math.max(...frets) < Math.max(...best.map((p) => p.fret)))
      best = frets.map((fret) => ({ string, fret }));
  }
  return best;
}

/**
 * Which way the first wrong note is off: 'higher' when the learner played below the target, 'lower'
 * when above, null when every played note matched (only missing or extra notes are left).
 */
export function firstMissDirection(grade: AttemptGrade): 'higher' | 'lower' | null {
  const wrong = grade.noteResults.find(
    (r) => r.status === 'wrong' && r.expectedMidi !== null && r.detectedMidi !== null,
  );
  if (!wrong || wrong.expectedMidi === wrong.detectedMidi) return null;
  return wrong.expectedMidi! > wrong.detectedMidi! ? 'higher' : 'lower';
}
