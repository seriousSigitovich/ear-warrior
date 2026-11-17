// Who the server knows the learner as (spec 024): the signed-in account when there is one, else a device-only identity
// the server made for this install. The anonymous token is kept apart from the account's, and dropped once the device
// signs in (the server folded that identity into the account). Never throws.
import type { KeyValueStore } from '../../lib/deviceId';
import type { RewardsClient } from './client';

export const ANON_TOKEN_KEY = 'ew.anonToken';

export interface Identity {
  /** The token to talk to the server with, or null when none can be had (no account and the server cannot be reached). */
  token(): Promise<string | null>;
  /** The server did not accept the token it was given: forget an anonymous one so the next call makes a new identity. */
  rejected(token: string): Promise<void>;
  /** The device signed in: the anonymous identity is gone on the server (merged); forget its token. */
  signedIn(): Promise<void>;
}

interface Deps {
  /** The signed-in session's token, or null. */
  accountToken: () => Promise<string | null>;
  kv: KeyValueStore;
  client: RewardsClient | null;
  deviceId: () => Promise<string>;
}

export function createIdentity({ accountToken, kv, client, deviceId }: Deps): Identity {
  // One request at a time: two first calls must not make two identities.
  let creating: Promise<string | null> | null = null;

  async function anonymous(): Promise<string | null> {
    const have = await kv.getItem(ANON_TOKEN_KEY).catch(() => null);
    if (have) return have;
    if (!client) return null;
    creating ??= (async () => {
      const made = await client.anonymous(await deviceId());
      if (made) await kv.setItem(ANON_TOKEN_KEY, made).catch(() => undefined);
      return made;
    })().finally(() => {
      creating = null;
    });
    return creating;
  }

  return {
    async token() {
      try {
        return (await accountToken()) ?? (await anonymous());
      } catch {
        return null;
      }
    },
    async rejected(token) {
      if ((await kv.getItem(ANON_TOKEN_KEY).catch(() => null)) === token)
        await kv.setItem(ANON_TOKEN_KEY, '').catch(() => undefined);
    },
    async signedIn() {
      await kv.setItem(ANON_TOKEN_KEY, '').catch(() => undefined);
    },
  };
}
