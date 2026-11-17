// Phrase checks the server has not answered yet (spec 024, FR-016): kept durably, in the order they were made, and sent
// when the device can reach the server. Each carries its own id, so sending one twice is harmless (the server answers
// from what it stored). A check the server will never accept is dropped; one it could not be asked stays.
import type { KeyValueStore } from '../../lib/deviceId';
import type { QueuedCheck } from './types';

export const CHECK_QUEUE_KEY = 'ew.checkQueue';

export interface CheckQueue {
  all(): Promise<QueuedCheck[]>;
  add(item: QueuedCheck): Promise<void>;
  remove(checkId: string): Promise<void>;
}

const valid = (x: unknown): x is QueuedCheck => {
  const o = x as Partial<QueuedCheck> | null;
  return (
    !!o &&
    typeof o.checkId === 'string' &&
    typeof o.tuneId === 'string' &&
    Number.isInteger(o.phrase) &&
    Array.isArray(o.played) &&
    o.played.every((n) => typeof n === 'number') &&
    typeof o.checkedAt === 'string' &&
    typeof o.localDay === 'string'
  );
};

export function createCheckQueue(kv: KeyValueStore): CheckQueue {
  // Reads and writes of the one stored list go one after the other, so an add never overwrites a concurrent remove.
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = chain.then(task, task);
    chain = run.catch(() => undefined);
    return run;
  };

  async function read(): Promise<QueuedCheck[]> {
    try {
      const raw: unknown = JSON.parse((await kv.getItem(CHECK_QUEUE_KEY)) ?? '[]');
      return Array.isArray(raw) ? raw.filter(valid) : [];
    } catch {
      return [];
    }
  }
  const write = (items: QueuedCheck[]) => kv.setItem(CHECK_QUEUE_KEY, JSON.stringify(items));

  return {
    all: () => serial(read),
    add: (item) =>
      serial(async () => {
        const items = await read();
        if (!items.some((i) => i.checkId === item.checkId)) await write([...items, item]);
      }),
    remove: (checkId) =>
      serial(async () => {
        const items = await read();
        if (items.some((i) => i.checkId === checkId))
          await write(items.filter((i) => i.checkId !== checkId));
      }),
  };
}
