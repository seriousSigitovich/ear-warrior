import { createSyncRunner } from '../../../src/services/sync/runner';

const flush = () => new Promise((r) => setImmediate(r));

describe('sync runner', () => {
  test('runs every step in order and says whether any brought something new', async () => {
    const order: string[] = [];
    const runner = createSyncRunner({
      steps: [
        async () => void order.push('a'),
        async () => {
          order.push('b');
          return true;
        },
        async () => void order.push('c'),
      ],
    });
    expect(await runner.request()).toBe(true);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  test('a failing step does not stop the others', async () => {
    const ran: string[] = [];
    const runner = createSyncRunner({
      steps: [
        async () => {
          throw new Error('boom');
        },
        async () => void ran.push('next'),
      ],
    });
    await expect(runner.request()).resolves.toBe(false);
    expect(ran).toEqual(['next']);
  });

  test('asked again within the minute it does nothing, unless forced', async () => {
    let t = 1_000_000;
    let runs = 0;
    const runner = createSyncRunner({ steps: [async () => void runs++], now: () => t });
    await runner.request();
    t += 30_000;
    await runner.request();
    expect(runs).toBe(1);
    await runner.request({ force: true });
    expect(runs).toBe(2);
    t += 61_000;
    await runner.request();
    expect(runs).toBe(3);
  });

  test('asked while running, it shares the run instead of starting another', async () => {
    let release: () => void = () => undefined;
    let runs = 0;
    const runner = createSyncRunner({
      steps: [
        () =>
          new Promise<void>((resolve) => {
            runs++;
            release = resolve;
          }),
      ],
    });
    const first = runner.request();
    const second = runner.request({ force: true });
    await flush();
    release();
    await Promise.all([first, second]);
    expect(runs).toBe(1);
  });
});
