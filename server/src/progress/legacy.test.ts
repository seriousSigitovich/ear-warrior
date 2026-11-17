import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { TUNES } from '../tunes/library.data.js';
import { createMemoryTuneStore } from '../tunes/memoryStore.js';
import { seedTunes } from '../tunes/seed.js';
import type { TuneStore } from '../tunes/store.js';
import type { LedgerStore } from './ledger.js';
import { createMemoryLedgerStore } from './ledgerMemoryStore.js';
import { importLegacyPhrases, legacyPhraseAccuracies, type LegacyPhrase } from './legacy.js';

const NOW = new Date('2026-11-16T10:00:00Z');
const at = (day: string, hour = 9) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00Z`);
let tunes: TuneStore;
let ledger: LedgerStore;
beforeEach(async () => {
  tunes = createMemoryTuneStore();
  await seedTunes(tunes, NOW);
  ledger = createMemoryLedgerStore();
});
const item = (tuneId: string, phrase: number, accuracy: number, when = at('2026-11-10')): LegacyPhrase => ({ tuneId, phrase, accuracy, at: when });

test('a passed phrase pays by the new rules: first attempt, no hint, the level multiplier', async () => {
  const hard = TUNES.find((t) => t.rank === 9)!;
  const r = await importLegacyPhrases(ledger, tunes, 'u', [item('hotcrossbuns', 0, 100), item(hard.id, 0, 90)], NOW);
  assert.deepEqual(r, { imported: 2, skipped: 0 });
  assert.equal((await ledger.totals('u')).totalXp, 20 + 15 * 15);
  assert.equal(await ledger.phrasePassed('u', 'hotcrossbuns', 0), true);
});

test('running it again changes nothing', async () => {
  await importLegacyPhrases(ledger, tunes, 'u', [item('hotcrossbuns', 0, 100)], NOW);
  const again = await importLegacyPhrases(ledger, tunes, 'u', [item('hotcrossbuns', 0, 100)], NOW);
  assert.deepEqual(again, { imported: 0, skipped: 1 });
  assert.equal((await ledger.totals('u')).totalXp, 20);
});

test('below the pass mark, an unknown tune or phrase, and a bad date are skipped', async () => {
  const r = await importLegacyPhrases(
    ledger, tunes, 'u',
    [item('hotcrossbuns', 0, 79), item('nope', 0, 100), item('hotcrossbuns', 9, 100), item('hotcrossbuns', -1, 100), item('hotcrossbuns', 1, 100, new Date('x'))],
    NOW,
  );
  assert.deepEqual(r, { imported: 0, skipped: 5 });
  assert.equal((await ledger.totals('u')).totalXp, 0);
});

test('accuracy is clamped to 0–100 and a date in the future is taken as now', async () => {
  await importLegacyPhrases(ledger, tunes, 'u', [item('hotcrossbuns', 0, 250, new Date('2030-01-01T00:00:00Z'))], NOW);
  assert.equal((await ledger.totals('u')).totalXp, 20);
  assert.deepEqual((await ledger.totals('u')).days, ['2026-11-16']);
});

test('the daily cap fills the way it would have then: oldest first, 300 base in full, the rest at half', async () => {
  const easy = TUNES.filter((t) => t.rank === 1);
  const items: LegacyPhrase[] = [];
  for (const t of easy) for (let p = 0; p < t.phrases.length; p++) items.push(item(t.id, p, 100, at('2026-11-10', 8 + (items.length % 10))));
  const take = items.slice(0, 17);
  await importLegacyPhrases(ledger, tunes, 'u', [...take].reverse(), NOW); // given out of order
  assert.equal((await ledger.totals('u')).totalXp, 15 * 20 + 2 * 10);
});

test('a phrase the account already passed live is not imported on top', async () => {
  await ledger.recordCheck(
    { userId: 'u', checkId: 'live', tuneId: 'hotcrossbuns', phrase: 0, played: [], noteResults: [], accuracy: 100, passed: true, localDay: '2026-11-16', checkedAt: NOW, now: NOW },
    () => ({ xp: 20, passed: true, base: 20, level_mult: 1, attempt_no: 1, attempt_factor: 1, hint_factor: 1, cap_factor: 1, reason: null, capBase: 20 }),
  );
  const r = await importLegacyPhrases(ledger, tunes, 'u', [item('hotcrossbuns', 0, 100)], NOW);
  assert.deepEqual(r, { imported: 0, skipped: 1 });
  assert.equal((await ledger.totals('u')).totalXp, 20);
});

test('legacyPhraseAccuracies splits note results by phrase and ignores extras', () => {
  const r = (i: number | null, status: string) => ({ targetIndex: i, status });
  const results = [r(0, 'matched'), r(1, 'wrong'), r(null, 'extra'), r(2, 'matched'), r(3, 'missed')];
  assert.deepEqual(legacyPhraseAccuracies(results, [2, 2]), [50, 50]);
  assert.deepEqual(legacyPhraseAccuracies([r(1, 'matched'), r(0, 'matched')], [2]), [100], 'out of order');
});

test('legacyPhraseAccuracies is null when the results cannot be split', () => {
  assert.equal(legacyPhraseAccuracies([{ expected: 'E4', status: 'matched' }], [1]), null, 'an old format without a target index');
  assert.equal(legacyPhraseAccuracies([{ targetIndex: 0, status: 'matched' }], [2]), null, 'fewer notes than the phrases');
  assert.equal(legacyPhraseAccuracies([null], [1]), null);
});
