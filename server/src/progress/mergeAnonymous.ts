// Spec 024 (FR-021): when a device signs in, the anonymous identity it played under is folded into the account and
// removed, so XP earned before signing in is kept and a phrase paid on both counts once.
import type { AuthStore } from '../auth/store.js';
import type { LedgerStore } from './ledger.js';

/** True when an anonymous identity of this device was merged into `userId`. */
export async function mergeAnonymous(auth: AuthStore, ledger: LedgerStore, deviceId: string, userId: string): Promise<boolean> {
  const anonymous = await auth.anonymousUserOf(deviceId, userId);
  if (!anonymous) return false;
  await ledger.merge(anonymous, userId);
  await auth.deleteUser(anonymous);
  return true;
}
