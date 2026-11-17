import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseNotes, phraseMidis } from './notes.js';
import { isVisible, validateAudio, validateTuneInput } from './validate.js';
import type { TuneInput } from './store.js';

const good: TuneInput = { id: 'mary', title: 'Mary', level: 1, tempoBpm: 110, phrases: [2, 1], notes: 'E4:1 D4:1 C4:2' };
const errors = (over: Partial<TuneInput>) => validateTuneInput({ ...good, ...over });

test('a good tune has no errors', () => assert.deepEqual(validateTuneInput(good), []));

test('id: lowercase letters and digits, no hyphen', () => {
  for (const id of ['', 'Mary', 'a-b', 'x'.repeat(61), 'a b']) assert.ok(errors({ id }).length > 0, id);
});

test('level 1–9, tempo above 0, a title', () => {
  for (const level of [0, 10, 1.5]) assert.ok(errors({ level }).length > 0, String(level));
  for (const tempoBpm of [0, -1, 401]) assert.ok(errors({ tempoBpm }).length > 0, String(tempoBpm));
  assert.ok(errors({ title: '  ' }).length > 0);
});

test('phrases must add up to the notes', () => {
  assert.match(errors({ phrases: [2, 2] }).join(), /add up/);
  assert.ok(errors({ phrases: [] }).length > 0);
  assert.ok(errors({ phrases: [3, 0] }).length > 0);
});

test('notes must be well-formed and inside E2–E5', () => {
  assert.ok(errors({ notes: 'E4 D4' }).length > 0);
  assert.ok(errors({ notes: 'H4:1 D4:1 C4:2' }).length > 0);
  assert.match(errors({ notes: 'D2:1 D4:1 C4:2' }).join(), /outside the fretboard/);
  assert.match(errors({ notes: 'E4:1 D4:1 F5:2' }).join(), /outside the fretboard/);
  assert.deepEqual(errors({ notes: 'E2:1 D4:1 E5:2' }), []);
});

test('audio: https url, sha256 hex, positive size', () => {
  assert.deepEqual(validateAudio({ url: 'https://x/y.m4a', sha256: 'f'.repeat(64), bytes: 1 }), []);
  assert.equal(validateAudio({ url: 'http://x', sha256: 'zz', bytes: 0 }).length, 3);
});

test('a tune is visible only when shown and it has audio', () => {
  const a = { hidden: false, audioUrl: 'https://x', audioSha256: 'a'.repeat(64) };
  assert.equal(isVisible(a), true);
  assert.equal(isVisible({ ...a, hidden: true }), false);
  assert.equal(isVisible({ ...a, audioUrl: null }), false);
});

test('parseNotes reads names, sharps, flats and rejects junk', () => {
  assert.deepEqual(parseNotes('C4:1 C#4:0.5 Bb3:2')?.map((n) => n.midi), [60, 61, 58]);
  assert.equal(parseNotes('C4:0'), null);
  assert.equal(parseNotes('nonsense'), null);
});

test('phraseMidis cuts the answer by the phrase lengths', () => {
  assert.deepEqual(phraseMidis('E4:1 D4:1 C4:2', [2, 1]), [[64, 62], [60]]);
  assert.equal(phraseMidis('E4:1 D4:1 C4:2', [2, 2]), null);
});
