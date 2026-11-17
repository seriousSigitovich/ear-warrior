import { ANON_TOKEN_KEY, createIdentity } from '../../../src/services/rewards/identity';
import type { RewardsClient } from '../../../src/services/rewards/client';
import { memoryKv } from './fixtures';

const client = (tokens: (string | null)[]) => {
  const made: string[] = [];
  const c = {
    anonymous: jest.fn(async (id: string) => {
      made.push(id);
      return tokens.shift() ?? null;
    }),
  } as unknown as RewardsClient;
  return { c, made };
};
const base = (over: Partial<Parameters<typeof createIdentity>[0]> = {}) => ({
  accountToken: async () => null,
  kv: memoryKv(),
  client: null,
  deviceId: async () => 'dev_1',
  ...over,
});

describe('identity', () => {
  it('is the account when signed in, and never makes an anonymous identity then', async () => {
    const { c } = client(['anon']);
    const id = createIdentity(base({ accountToken: async () => 'acct', client: c }));
    expect(await id.token()).toBe('acct');
    expect(c.anonymous).not.toHaveBeenCalled();
  });

  it('makes an anonymous identity once for the device and keeps it', async () => {
    const kv = memoryKv();
    const { c, made } = client(['anon1', 'anon2']);
    const id = createIdentity(base({ kv, client: c }));
    expect(await id.token()).toBe('anon1');
    expect(await id.token()).toBe('anon1');
    expect(made).toEqual(['dev_1']);
    expect(kv.data.get(ANON_TOKEN_KEY)).toBe('anon1');
    expect(await createIdentity(base({ kv, client: c })).token()).toBe('anon1');
  });

  it('two first calls at once make one identity', async () => {
    const { c } = client(['anon1', 'anon2']);
    const id = createIdentity(base({ client: c }));
    expect(await Promise.all([id.token(), id.token()])).toEqual(['anon1', 'anon1']);
    expect(c.anonymous).toHaveBeenCalledTimes(1);
  });

  it('has no token when there is no account and the server cannot be reached', async () => {
    expect(await createIdentity(base({ client: client([null]).c })).token()).toBeNull();
    expect(await createIdentity(base()).token()).toBeNull();
  });

  it('forgets a rejected anonymous token (and only that one), so the next call makes a new identity', async () => {
    const kv = memoryKv();
    const { c } = client(['anon1', 'anon2']);
    const id = createIdentity(base({ kv, client: c }));
    await id.token();
    await id.rejected('some-other-token');
    expect(await id.token()).toBe('anon1');
    await id.rejected('anon1');
    expect(await id.token()).toBe('anon2');
  });

  it('drops the anonymous token once the device signs in', async () => {
    const kv = memoryKv();
    const { c } = client(['anon1', 'anon2']);
    const id = createIdentity(base({ kv, client: c }));
    await id.token();
    await id.signedIn();
    expect(await id.token()).toBe('anon2');
  });

  it('never throws', async () => {
    const id = createIdentity(
      base({
        accountToken: async () => {
          throw new Error('boom');
        },
      }),
    );
    expect(await id.token()).toBeNull();
  });
});
