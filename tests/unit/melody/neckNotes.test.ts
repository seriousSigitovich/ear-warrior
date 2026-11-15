import { fretMidi } from '../../../src/lib/fretboard';
import { LIBRARY, curatedMelody } from '../../../src/services/melody/curated';
import { answeredPhraseNotes } from '../../../src/services/melody/neckNotes';
import { getLevelByRank } from '../../../src/services/melody/levels';

describe('the notes shown on the neck for a half-answered tune', () => {
  const tune = LIBRARY.find((t) => t.id === 'hotcrossbuns')!;
  const melody = curatedMelody(getLevelByRank(tune.rank), 0, tune.id);

  test('nothing before a phrase is answered, and nothing for an unknown tune', () => {
    expect(answeredPhraseNotes(tune.id, 0)).toEqual([]);
    expect(answeredPhraseNotes('no-such-tune', 2)).toEqual([]);
  });

  test('the first answered phrase: its own notes, in order', () => {
    const shown = answeredPhraseNotes(tune.id, 1);
    const first = melody.notes.slice(0, tune.phrases[0]).map((n) => n.midi);
    expect(shown.map(fretMidi)).toEqual(first);
  });

  test('later: the last phrase answered, not all of them; past the end it stays on the last', () => {
    const second = melody.notes.slice(tune.phrases[0]).map((n) => n.midi);
    expect(answeredPhraseNotes(tune.id, 2).map(fretMidi)).toEqual(second);
    expect(answeredPhraseNotes(tune.id, 9).map(fretMidi)).toEqual(second);
  });
});
