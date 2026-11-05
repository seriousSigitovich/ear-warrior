import assert from 'node:assert/strict';
import { test } from 'node:test';
import { draftReply, grade, namesTune, parseAnswer } from './answer.js';

// Korobeiniki's opening (the #65 key): E4 B3 C4 D4 C4 B3 A3 A3
const KORO = [64, 59, 60, 62, 60, 59, 57, 57];
// Mountain King (#60): B2 C#3 D3 E3 F#3 D3 F#3
const KING = [47, 49, 50, 52, 54, 50, 54];

const check = (text: string, melody = KORO) => {
  const p = parseAnswer(text);
  assert.ok(p, `no answer read from ${JSON.stringify(text)}`);
  return grade(p, melody);
};

test('note names with spaces, the whole tune', () => {
  const g = check('E B C D C B A A');
  assert.equal(g.verdict, 'correct');
  assert.equal(g.matched, 8);
  assert.equal(g.shift, 0);
});

test('names glued together and with octaves', () => {
  assert.equal(check('EBCDCBAA').verdict, 'correct');
  assert.equal(check('E4 B3 C4 D4').verdict, 'correct');
  assert.equal(check('e, b, c, d, c, b, a').verdict, 'correct');
});

test('repeated note written once still counts', () => {
  assert.equal(check('E B C D C B A').verdict, 'correct');
});

test('the answer inside a sentence', () => {
  const g = check('easy 😎 E-B-C-D-C-B-A-A first try');
  assert.equal(g.verdict, 'correct');
});

test('another key counts and says so', () => {
  // A up a fourth: A E F G F E D D
  const g = check('A E F G F E D D');
  assert.equal(g.verdict, 'correct');
  assert.equal(g.shift, 5);
  assert.match(draftReply(g)!, /another key/);
});

test('one wrong note: partial, with the place', () => {
  const g = check('E B C D C A A A');
  assert.equal(g.verdict, 'partial');
  assert.equal(g.matched, 5);
  assert.deepEqual(g.miss, { at: 5, said: 'A', expected: 'B' });
  assert.match(draftReply(g)!, /first 5 notes are right/);
});

test('sharps and flats', () => {
  assert.equal(check('B C# D E F# D F#', KING).verdict, 'correct');
  assert.equal(check('B Db D E Gb D Gb', KING).verdict, 'correct');
});

test('solfège, Latin and Cyrillic', () => {
  assert.equal(check('mi si do re do si la').verdict, 'correct');
  assert.equal(check('ми си до ре до си ля').verdict, 'correct');
});

test('bare frets on one string', () => {
  // King on the A string: 2 4 5 7 9 5 9
  const g = check('2 4 5 7 9 5 9', KING);
  assert.equal(g.kind, 'frets');
  assert.equal(g.verdict, 'correct');
});

test('bare frets across strings (each fret fits some string)', () => {
  // King in first position: B2 = A2, C#3 = A4, D3 = D0, E3 = D2, F#3 = D4, D3 = D0, F#3 = D4
  assert.equal(check('2 4 0 2 4 0 4', KING).verdict, 'correct');
});

test('an ASCII tab', () => {
  const tab = ['e|-------------|', 'B|-------------|', 'G|-------------|', 'D|-----0-2-4-0-4|', 'A|-2-4---------|', 'E|-------------|'].join('\n');
  const g = check(tab, KING);
  assert.equal(g.kind, 'tab');
  assert.equal(g.verdict, 'correct');
});

test('no answer: praise, questions, ordinary words', () => {
  for (const t of ['Nice video!', 'What song is this?', 'I had a bad day', 'so do I', '🔥🔥🔥', 'A great tune', 'Bach']) {
    assert.equal(parseAnswer(t), null, t);
  }
});

test('a wrong start is wrong', () => {
  const g = check('C D E F G');
  assert.equal(g.verdict, 'wrong');
});

test('stray notes before the melody are skipped', () => {
  // A real comment under #69: a pickup A, then the Bumblebee's chromatic run (E D# D C# then it differs)
  const BEE = [64, 63, 62, 61, 62, 61, 60, 59];
  const g = check('isnt that A E D# D C# C B A# A G# G', BEE);
  assert.equal(g.verdict, 'partial');
  assert.equal(g.matched, 4);
});

test('naming the tune', () => {
  assert.ok(namesTune('Toccata and Fugue in D minor by Bach', ['toccata']));
  assert.ok(namesTune('Nu pogodi', ['nu pogodi']));
  assert.ok(namesTune('Очи чёрные!', ['очи черные']));
  assert.ok(!namesTune('Hmm.. the big dipper', ['toccata']));
  assert.ok(!namesTune('cannon fodder', ['canon']));
});
