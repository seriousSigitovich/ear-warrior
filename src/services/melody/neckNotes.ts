// The notes of the phrase the learner answered last in a library tune, as positions on the neck (Home, spec 023).
// Only phrases already answered are shown: where the next ones sit would give the answer away.
import { phraseCount, phraseRange } from '../../lib/phrases';
import { FretPosition } from '../../lib/fretboard';
import { neckPositions } from '../../lib/neckNotes';
import { catalogTune } from './catalog';
import { curatedMelody } from './curated';
import { getLevelByRank } from './levels';

/** The last answered phrase of `tuneId` when `answered` phrases are done; nothing for none, or an unknown tune. */
export function answeredPhraseNotes(tuneId: string, answered: number): FretPosition[] {
  const tune = catalogTune(tuneId);
  if (!tune || answered <= 0) return [];
  const melody = curatedMelody(getLevelByRank(tune.rank), 0, tuneId);
  const last = Math.min(answered, phraseCount(melody)) - 1;
  const { start, end } = phraseRange(melody, last);
  return neckPositions(melody.notes.slice(start, end).map((n) => n.midi));
}
