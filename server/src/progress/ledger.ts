// Persistence seam of the XP ledger and phrase checks (spec 024). Postgres in production (ledgerPgStore.ts), memory in
// tests (ledgerMemoryStore.ts), one contract (ledger.contract.ts). The rules that must hold under concurrency — a phrase
// pays once, a resent check changes nothing, the daily cap counts every check — are one atomic method here.
import type { Payout } from '../game/xp.js';

export interface CheckInput {
  userId: string;
  /** The device's id for this check; resending it changes nothing. */
  checkId: string;
  tuneId: string;
  phrase: number;
  /** Midi in tap order. */
  played: number[];
  noteResults: unknown;
  accuracy: number;
  /** accuracy at or above the pass mark. */
  passed: boolean;
  /** The learner's local day for this check (already bounded by the route). */
  localDay: string;
  checkedAt: Date;
  /** Server time of the call. */
  now: Date;
}

/** What the payout needs to know, read inside the same transaction that writes the check. */
export interface CheckContext {
  /** 1 for the account's first check of this phrase. */
  attemptNo: number;
  /** A hint was taken before this check. */
  hint: boolean;
  /** The answer was shown before this check. */
  answerShown: boolean;
  /** An earlier check of this phrase already passed. */
  alreadyPassed: boolean;
  /** Base XP already counted toward the cap on `localDay`. */
  baseUsedToday: number;
}

export interface StoredCheck {
  checkId: string;
  tuneId: string;
  phrase: number;
  attemptNo: number;
  played: number[];
  noteResults: unknown;
  accuracy: number;
  passed: boolean;
  xp: number;
  payout: Payout;
  localDay: string;
}

export interface RecordedCheck {
  check: StoredCheck;
  /** True when this `checkId` was already stored: nothing was written and `check` is the stored one. */
  replay: boolean;
}

export type EventKind = 'hint' | 'answer';

export interface PhraseRecord {
  tuneId: string;
  phrase: number;
  /** Accuracy of the first check of the phrase. */
  firstAccuracy: number;
  /** The local day the phrase was first passed; null while open. */
  passedDay: string | null;
}

export interface LedgerRow {
  key: string;
  kind: 'phrase' | 'challenge' | 'daily-all' | 'legacy';
  xp: number;
  breakdown: Record<string, unknown>;
  localDay: string;
  at: Date;
}

export interface LedgerStore {
  getCheck(userId: string, checkId: string): Promise<StoredCheck | null>;
  /**
   * Stores a check and, when it is the first pass of the phrase, its ledger row and the day's cap use — one
   * transaction. `compute` receives the context and returns the payout; it is not called for a replay or a phrase that
   * already passed (those pay `alreadyPaid`).
   */
  recordCheck(input: CheckInput, compute: (ctx: CheckContext) => Payout): Promise<RecordedCheck>;
  /** Records that a hint or the answer was shown for a phrase; a no-op once the phrase passed. Returns whether it had passed. */
  recordEvent(userId: string, tuneId: string, phrase: number, kind: EventKind, now: Date): Promise<{ passed: boolean }>;
  /** Whether the phrase already passed (the reveal endpoints are free after that). */
  phrasePassed(userId: string, tuneId: string, phrase: number): Promise<boolean>;
  totals(userId: string): Promise<{ totalXp: number; days: string[] }>;
  /** One record per phrase the account has checked. */
  phraseRecords(userId: string): Promise<PhraseRecord[]>;
  /** Adds a row unless the key is already there. True when it was added. */
  addLedger(userId: string, row: LedgerRow): Promise<boolean>;
  ledgerKeys(userId: string, prefix: string): Promise<string[]>;
  /** Base XP counted toward the cap on a day. */
  baseUsed(userId: string, day: string): Promise<number>;
  /**
   * Spec 024 (FR-021): folds one account's checks, events, ledger and cap use into another's, in one transaction —
   * a ledger key both have stays the target's (a phrase counts once), cap use adds up per day. The source is left
   * empty; the caller deletes the account.
   */
  merge(fromUserId: string, toUserId: string): Promise<void>;
}
