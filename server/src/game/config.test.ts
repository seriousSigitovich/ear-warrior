// The reward numbers must stay coherent (spec 024 FR-009, FR-013, FR-014, SC-002).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ATTEMPT_FACTOR, LEVEL_MULT, LOCAL_ANSWER_MAX_LEVEL, MAX_LEVEL, RANKS, maxPhraseXp } from './config.js';
import { TUNES } from '../tunes/library.data.js';

/** Most XP all phrases of each level can pay (perfect play), index 0 = level 1. */
function potentialByLevel(): number[] {
  const out = new Array<number>(MAX_LEVEL).fill(0);
  for (const t of TUNES) out[t.rank - 1] += t.phrases.length * maxPhraseXp(t.rank);
  return out;
}
const cumulative = (levels: number[], upTo: number) => levels.slice(0, upTo).reduce((a, b) => a + b, 0);

test('the multipliers start at 1, increase every level, and grow faster than linearly', () => {
  assert.equal(LEVEL_MULT[0], 1);
  assert.equal(LEVEL_MULT.length, 9);
  for (let i = 1; i < LEVEL_MULT.length; i++) assert.ok(LEVEL_MULT[i] > LEVEL_MULT[i - 1], `level ${i + 1}`);
  // Steeper than a straight line from level 1 to level 9.
  const line = (i: number) => 1 + ((LEVEL_MULT[8] - 1) * i) / 8;
  const below = LEVEL_MULT.filter((m, i) => m < line(i)).length;
  assert.ok(below >= 6, `most levels sit below the straight line (convex), got ${below}`);
});

test('retries only ever pay less', () => {
  assert.equal(ATTEMPT_FACTOR[0], 1);
  for (let i = 1; i < ATTEMPT_FACTOR.length; i++) assert.ok(ATTEMPT_FACTOR[i] <= ATTEMPT_FACTOR[i - 1]);
});

test('rank thresholds start at 0 and strictly increase', () => {
  assert.equal(RANKS[0].xp, 0);
  for (let i = 1; i < RANKS.length; i++) assert.ok(RANKS[i].xp > RANKS[i - 1].xp, RANKS[i].name);
  assert.equal(new Set(RANKS.map((r) => r.id)).size, RANKS.length);
});

test('SC-002: all easy levels at full value are not enough for the top ranks', () => {
  const lv = potentialByLevel();
  const maestro = RANKS.find((r) => r.id === 'maestro')!.xp;
  const mozart = RANKS.find((r) => r.id === 'mozart')!.xp;
  assert.ok(cumulative(lv, 5) < maestro, `levels 1-5 give at most ${cumulative(lv, 5)}, Maestro needs ${maestro}`);
  assert.ok(cumulative(lv, 7) < mozart, `levels 1-7 give at most ${cumulative(lv, 7)}, Mozart needs ${mozart}`);
});

test('each rank above Listener needs work one level higher than the rank below', () => {
  const lv = potentialByLevel();
  // The level a rank cannot be reached without: the first level at which the cumulative potential covers it.
  const levelNeeded = (xp: number) => {
    for (let n = 1; n <= MAX_LEVEL; n++) if (cumulative(lv, n) >= xp) return n;
    return MAX_LEVEL;
  };
  const ranks = RANKS.slice(3);
  const needed = ranks.map((r) => levelNeeded(r.xp));
  for (let i = 1; i < needed.length; i++) assert.ok(needed[i] > needed[i - 1], `${ranks[i].name} needs level ${needed[i]}`);
});

test('the library covers every level with phrases, and every rank is reachable at all', () => {
  const lv = potentialByLevel();
  for (const [i, v] of lv.entries()) assert.ok(v > 0, `level ${i + 1} has phrases`);
  assert.ok(cumulative(lv, MAX_LEVEL) > RANKS[RANKS.length - 1].xp, 'the top rank is below the library total');
});

test('the answers shipped in the app (levels up to LOCAL_ANSWER_MAX_LEVEL) cannot buy a rank above Listener', () => {
  const lv = potentialByLevel();
  const musician = RANKS.find((r) => r.id === 'musician')!.xp;
  assert.ok(
    cumulative(lv, LOCAL_ANSWER_MAX_LEVEL) < musician,
    `levels 1-${LOCAL_ANSWER_MAX_LEVEL} pay at most ${cumulative(lv, LOCAL_ANSWER_MAX_LEVEL)} XP, Musician needs ${musician}`,
  );
});
