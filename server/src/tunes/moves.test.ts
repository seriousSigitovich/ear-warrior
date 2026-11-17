import assert from 'node:assert/strict';
import { test } from 'node:test';
import { intervalKind, movesOf } from './moves.js';

test('kinds by size and direction', () => {
  assert.equal(intervalKind(0), 'repeat');
  assert.equal(intervalKind(2), 'step:up');
  assert.equal(intervalKind(-1), 'step:down');
  assert.equal(intervalKind(4), 'third:up');
  assert.equal(intervalKind(-5), 'fourthFifth:down');
  assert.equal(intervalKind(7), 'fourthFifth:up');
  assert.equal(intervalKind(9), 'wide:up');
});

test('moves are counted inside phrases, never across their boundary', () => {
  // E4 D4 | C4 C4 D4: moves are E→D, C→C, C→D; D→C across the boundary is not one.
  const m = movesOf('E4:1 D4:1 C4:1 C4:1 D4:1', [2, 3]);
  assert.deepEqual(m, { counts: { 'step:down': 1, repeat: 1, 'step:up': 1 }, total: 3 });
});

test('notes that do not match the phrases give no moves', () => {
  assert.deepEqual(movesOf('E4:1 D4:1', [3]), { counts: {}, total: 0 });
});
