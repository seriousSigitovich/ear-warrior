// The server grader against the fixtures it shares with the app's grader (tests/unit/graderParity.test.ts).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { gradePhrase } from './grade.js';

interface Fixture {
  name: string;
  answer: number[];
  played: number[];
  expected: { accuracy: number; results: { status: string; targetIndex: number | null; expectedMidi: number | null; detectedMidi: number | null }[] };
}
const fixtures: Fixture[] = JSON.parse(readFileSync(new URL('./grade.fixtures.json', import.meta.url), 'utf8'));

for (const f of fixtures) {
  test(`fixture: ${f.name}`, () => {
    const g = gradePhrase(f.answer, f.played);
    assert.equal(g.accuracy, f.expected.accuracy);
    assert.deepEqual(g.noteResults, f.expected.results);
  });
}

test('passed from 80 % of the answer notes', () => {
  const answer = [60, 62, 64, 65, 67];
  assert.equal(gradePhrase(answer, [60, 62, 64, 65, 67]).passed, true);
  assert.equal(gradePhrase(answer, [60, 62, 64, 65, 70]).accuracy, 80);
  assert.equal(gradePhrase(answer, [60, 62, 64, 65, 70]).passed, true);
  assert.equal(gradePhrase(answer, [60, 62, 64, 70, 70]).passed, false);
});

test('extra notes do not lower the accuracy', () => {
  assert.equal(gradePhrase([60, 62], [60, 62, 64, 65]).accuracy, 100);
});

test('an empty answer scores 0 and an empty play scores 0', () => {
  assert.equal(gradePhrase([], [60]).accuracy, 0);
  assert.equal(gradePhrase([60], []).accuracy, 0);
});
