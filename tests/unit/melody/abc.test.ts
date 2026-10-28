// The ABC reader turns the Nottingham tunes into note lists, so these tests pin the parts of ABC that
// change which pitch comes out: key signatures, accidentals that last a bar, octave marks, ties,
// and the breaks that stop a window from joining notes that never follow each other.
import { AbcNote, parseAbc } from '../../../src/services/melody/abc';

function tune(header: string, body: string) {
  const file = parseAbc(`X: 1\nT:Test\n${header}\n${body}\n`);
  expect(file.skipped).toEqual([]);
  return file.tunes[0];
}

const midis = (notes: AbcNote[]) => notes.map((n) => n.midi);

describe('parseAbc: pitch', () => {
  test('reads the first bars of a real tune (key G, quarter-note unit)', () => {
    const t = tune('M:3/4\nL:1/4\nK:G', 'D|"G"G3/2B/2"D7"A/2F/2|"G"GAB|');
    expect(t.number).toBe(1);
    expect(t.title).toBe('Test');
    expect(t.segments).toHaveLength(1);
    const notes = t.segments[0];
    expect(midis(notes)).toEqual([62, 67, 71, 69, 66, 67, 69, 71]); // F is F# in G major
    expect(notes.map((n) => n.beats)).toEqual([1, 1.5, 0.5, 0.5, 0.5, 1, 1, 1]);
    expect(notes.map((n) => n.barStart)).toEqual([true, true, false, false, false, true, false, false]);
  });

  test('an accidental lasts to the end of the bar, and only for that octave', () => {
    const t = tune('L:1/4\nK:C', '^F F f | F');
    expect(midis(t.segments[0])).toEqual([66, 66, 77, 65]);
  });

  test('a natural cancels the key signature for the rest of the bar', () => {
    const t = tune('L:1/4\nK:G', '=F F | F');
    expect(midis(t.segments[0])).toEqual([65, 65, 66]);
  });

  test('minor keys carry their relative major’s signature', () => {
    expect(midis(tune('L:1/4\nK:Em', 'F').segments[0])).toEqual([66]);
    expect(midis(tune('L:1/4\nK:Dm', 'B').segments[0])).toEqual([70]);
    expect(midis(tune('L:1/4\nK:Bb', 'B E A').segments[0])).toEqual([70, 63, 69]); // two flats: B, E
  });

  test('octave marks: lower case is an octave up, ′ up, , down', () => {
    expect(midis(tune('L:1/4\nK:C', "C c c' C,").segments[0])).toEqual([60, 72, 84, 48]);
  });

  test('chord symbols, decorations and grace notes are dropped', () => {
    const t = tune('L:1/4\nK:C', '"Am"!trill!{g}A "C"B +fermata+c|');
    expect(midis(t.segments[0])).toEqual([69, 71, 72]);
  });

  test('a chord keeps its top note and its length', () => {
    const t = tune('L:1/4\nK:C', '[CE]G [C2E2]');
    expect(midis(t.segments[0])).toEqual([64, 67, 64]);
    expect(t.segments[0][2].beats).toBe(2);
  });
});

describe('parseAbc: length', () => {
  test.each([
    ['M:4/4', 0.5],
    ['M:6/8', 0.5],
    ['M:2/4', 0.25],
  ])('with %s and no L:, the unit follows the ABC default', (meter, beats) => {
    expect(tune(`${meter}\nK:C`, 'C').segments[0][0].beats).toBe(beats);
  });

  test('a tie merges two notes into one', () => {
    const t = tune('L:1/4\nK:C', 'C2-C2 D|');
    expect(midis(t.segments[0])).toEqual([60, 62]);
    expect(t.segments[0][0].beats).toBe(4);
  });

  test('a tie across a bar line merges too, and the next note is not a bar start', () => {
    const t = tune('L:1/4\nK:C', 'C-|C D');
    expect(midis(t.segments[0])).toEqual([60, 62]);
    expect(t.segments[0][0].beats).toBe(2);
    expect(t.segments[0][1].barStart).toBe(false);
  });

  test('a triplet fits three notes in the time of two', () => {
    const t = tune('L:1/4\nK:C', '(3C/2D/2E/2 F');
    expect(t.segments[0][0].beats).toBeCloseTo(1 / 3);
    expect(t.segments[0][3].beats).toBe(1);
  });
});

describe('parseAbc: segments', () => {
  test('a repeat sign ends a segment', () => {
    const t = tune('L:1/4\nK:C', '|:C D E F:|G A B c|');
    expect(t.segments.map(midis)).toEqual([[60, 62, 64, 65], [67, 69, 71, 72]]);
  });

  test('a rest ends a segment', () => {
    const t = tune('L:1/4\nK:C', 'C D z E F');
    expect(t.segments.map(midis)).toEqual([[60, 62], [64, 65]]);
  });

  test('first and second endings are separate segments', () => {
    const t = tune('L:1/4\nK:C', 'C D E F|[1 G A :|[2 B c|]');
    expect(t.segments.map(midis)).toEqual([[60, 62, 64, 65], [67, 69], [71, 72]]);
  });

  test('a key change ends a segment and changes the signature', () => {
    const t = tune('L:1/4\nK:C', 'F G\nK:G\nF G');
    expect(t.segments.map(midis)).toEqual([[65, 67], [66, 67]]);
  });

  test('a plain bar line does not end a segment', () => {
    const t = tune('L:1/4\nK:C', 'C D|E F|G A');
    expect(t.segments).toHaveLength(1);
  });
});

describe('parseAbc: file', () => {
  test('keeps the S: line as the tune’s source', () => {
    const t = tune('S:Kevin Briggs\nL:1/4\nK:C', 'C D E');
    expect(t.source).toBe('Kevin Briggs');
  });

  test('reads several tunes and skips those it cannot use', () => {
    const file = parseAbc(
      [
        'X: 1\nT:One\nL:1/4\nK:C\nC D E',
        'X: 2\nT:Two voices\nL:1/4\nK:C\nV:1\nC D E\nV:2\nE F G',
        'X: 3\nT:No key\nL:1/4\nC D E',
        'X: 4\nT:Four\nL:1/4\nK:G\nG A B',
      ].join('\n\n'),
    );
    expect(file.tunes.map((t) => t.title)).toEqual(['One', 'Four']);
    expect(file.tunes.map((t) => t.source)).toEqual(['', '']);
    expect(file.skipped).toEqual([
      { number: 2, title: 'Two voices', reason: 'more than one voice' },
      { number: 3, title: 'No key', reason: 'no K: line' },
    ]);
  });
});
