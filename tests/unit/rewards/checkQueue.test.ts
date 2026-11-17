import { CHECK_QUEUE_KEY, createCheckQueue } from '../../../src/services/rewards/checkQueue';
import type { QueuedCheck } from '../../../src/services/rewards/types';
import { memoryKv } from './fixtures';

const q = (id: string): QueuedCheck => ({
  checkId: id,
  tuneId: 'mary',
  phrase: 0,
  played: [64],
  checkedAt: '2026-11-16T10:00:00.000Z',
  localDay: '2026-11-16',
});

describe('check queue', () => {
  it('keeps checks in the order they were made, durably', async () => {
    const kv = memoryKv();
    const queue = createCheckQueue(kv);
    await queue.add(q('a'));
    await queue.add(q('b'));
    expect((await createCheckQueue(kv).all()).map((i) => i.checkId)).toEqual(['a', 'b']);
  });

  it('adds a check id once and removes one by id', async () => {
    const queue = createCheckQueue(memoryKv());
    await queue.add(q('a'));
    await queue.add(q('a'));
    await queue.add(q('b'));
    await queue.remove('a');
    await queue.remove('nope');
    expect((await queue.all()).map((i) => i.checkId)).toEqual(['b']);
  });

  it('simultaneous adds and removes lose nothing', async () => {
    const queue = createCheckQueue(memoryKv());
    await Promise.all([queue.add(q('a')), queue.add(q('b')), queue.add(q('c'))]);
    await Promise.all([queue.remove('b'), queue.add(q('d'))]);
    expect((await queue.all()).map((i) => i.checkId)).toEqual(['a', 'c', 'd']);
  });

  it('survives a damaged store and skips items that are not checks', async () => {
    expect(await createCheckQueue(memoryKv({ [CHECK_QUEUE_KEY]: '{oops' })).all()).toEqual([]);
    const kv = memoryKv({ [CHECK_QUEUE_KEY]: JSON.stringify([q('a'), { checkId: 5 }, null]) });
    expect((await createCheckQueue(kv).all()).map((i) => i.checkId)).toEqual(['a']);
  });
});
