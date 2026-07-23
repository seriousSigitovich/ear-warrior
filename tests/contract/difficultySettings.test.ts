// T058 — DifficultySettings repository (FR-011b, data-model.md).
// The singleton row that makes difficulty survive session end and app restart.
import { DifficultySettings } from '../../src/models';
import { createInMemoryRowStore } from '../../src/services/storage/db';
import { createDifficultySettingsRepository } from '../../src/services/storage/repositories';
import { DEFAULT_DIFFICULTY_SETTINGS, setFixedRank } from '../../src/features/difficulty/adapt';

const CUSTOM: DifficultySettings = {
  mode: 'fixed',
  adaptiveRank: 5,
  fixedRank: 2,
  streakKind: 'correct',
  streakCount: 2,
};

describe('difficulty settings repository (FR-011b)', () => {
  test('first launch returns the documented defaults', async () => {
    const repo = createDifficultySettingsRepository(createInMemoryRowStore());
    expect(await repo.load()).toEqual(DEFAULT_DIFFICULTY_SETTINGS);
  });

  test('a save/load round-trip preserves every field', async () => {
    const repo = createDifficultySettingsRepository(createInMemoryRowStore());
    await repo.save(CUSTOM);
    expect(await repo.load()).toEqual(CUSTOM);
  });

  test('saving twice overwrites rather than appending a second row', async () => {
    const repo = createDifficultySettingsRepository(createInMemoryRowStore());
    await repo.save(CUSTOM);
    await repo.save({ ...CUSTOM, adaptiveRank: 6 });
    expect((await repo.load()).adaptiveRank).toBe(6);
  });

  test('a persisted fixed-rank change leaves the stored adaptive rank untouched', async () => {
    const repo = createDifficultySettingsRepository(createInMemoryRowStore());
    await repo.save({ ...DEFAULT_DIFFICULTY_SETTINGS, adaptiveRank: 5 });
    const loaded = await repo.load();
    await repo.save(setFixedRank(loaded, 2));
    const after = await repo.load();
    expect(after.fixedRank).toBe(2);
    expect(after.adaptiveRank).toBe(5);
  });

  test('settings survive a repository instance being recreated over the same store', async () => {
    const store = createInMemoryRowStore();
    await createDifficultySettingsRepository(store).save(CUSTOM);
    // A fresh repository over the same durable store stands in for an app restart.
    expect(await createDifficultySettingsRepository(store).load()).toEqual(CUSTOM);
  });
});
