import { BackgroundUpdater, UpdatesApi } from '../../../src/lib/launchUpdate';

function api(over: Partial<UpdatesApi> = {}): UpdatesApi & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    checkForUpdateAsync: async () => (calls.push('check'), { isAvailable: true }),
    fetchUpdateAsync: async () => (calls.push('fetch'), { isNew: true }),
    reloadAsync: async () => void calls.push('reload'),
    ...over,
  };
}

describe('BackgroundUpdater', () => {
  it('downloads at once but restarts only when the app goes to the background', async () => {
    const a = api();
    const u = new BackgroundUpdater(a);
    expect(await u.check()).toBe('ready');
    expect(a.calls).toEqual(['check', 'fetch']);
    expect(await u.applyIfReady()).toBe(true);
    expect(a.calls).toEqual(['check', 'fetch', 'reload']);
  });

  it('does not restart when nothing was downloaded', async () => {
    const a = api({ checkForUpdateAsync: async () => ({ isAvailable: false }) });
    const u = new BackgroundUpdater(a);
    expect(await u.check()).toBe('none');
    expect(await u.applyIfReady()).toBe(false);
    expect(a.calls).toEqual([]);
  });

  it('ignores a fetched update that is not new', async () => {
    const a = api({ fetchUpdateAsync: async () => ({ isNew: false }) });
    const u = new BackgroundUpdater(a);
    expect(await u.check()).toBe('none');
    expect(await u.applyIfReady()).toBe(false);
  });

  it('survives a network failure and tries again next time', async () => {
    let fail = true;
    const a = api({
      checkForUpdateAsync: async () => {
        if (fail) throw new Error('offline');
        return { isAvailable: true };
      },
    });
    const u = new BackgroundUpdater(a);
    expect(await u.check()).toBe('error');
    fail = false;
    expect(await u.check()).toBe('ready');
  });

  it('does not download twice at the same time', async () => {
    let release: () => void = () => undefined;
    const a = api({
      fetchUpdateAsync: () => new Promise((r) => (release = () => r({ isNew: true }))),
    });
    const u = new BackgroundUpdater(a);
    const first = u.check();
    expect(await u.check()).toBe('none');
    await Promise.resolve();
    release();
    expect(await first).toBe('ready');
  });

  it('survives a failed reload', async () => {
    const u = new BackgroundUpdater(
      api({
        reloadAsync: async () => {
          throw new Error('x');
        },
      }),
    );
    await u.check();
    expect(await u.applyIfReady()).toBe(false);
  });
});
