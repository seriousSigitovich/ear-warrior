// Persistence seam of the progress routes (same shape as auth/store.ts): Postgres in production
// (pgStore.ts), memory in route tests (memoryStore.ts). Everything is scoped to one account.

export interface ProgressAttempt {
  /** Client-generated, unique per account: posting it twice stores it once. */
  id: string;
  sessionId: string;
  melodyId: string;
  /** The library tune the melody came from (the part of `melodyId` before the first hyphen). */
  tuneId: string;
  verdict: 'correct' | 'incorrect';
  confidence: number;
  lowConfidence: boolean;
  timedOut: boolean;
  inputMode: 'mic' | 'fretboard';
  noteResults: unknown[];
  createdAt: Date;
}

export interface ProgressDifficulty {
  mode: 'adaptive' | 'fixed';
  adaptiveRank: number;
  fixedRank: number;
  streakKind: 'correct' | 'incorrect' | 'none';
  streakCount: number;
}

/**
 * Where a learner stopped in a melody (spec 017): the phrase to continue at and how each answered phrase went on
 * its first try. One per account and tune; the latest write wins by `updatedAt`.
 */
export interface MelodyPlace {
  /** The library tune (hyphen-free id). */
  tuneId: string;
  /** 0-based phrase to continue at. */
  phrase: number;
  phrases: number;
  /** First-try results of the answered phrases, as the app sent them (opaque to the server). */
  grades: unknown[];
  updatedAt: Date;
}

/** The three kinds of rows the reward system keeps (spec 013), stored as the app made them (spec 019). */
export type GameKind = 'award' | 'completion' | 'mastery';

export interface GameRowInput {
  kind: GameKind;
  /** Stable and unique per kind: a row is the same wherever it is made, so storing it twice changes nothing. */
  id: string;
  data: Record<string, unknown>;
}

/** A game row as read back: `seq` is the server's order of arrival, the cursor a device pulls by. */
export interface GameRowOut extends GameRowInput {
  seq: number;
}

export interface GamePage {
  rows: GameRowOut[];
  /** Where to continue: the last `seq` returned (the cursor asked with when there were none). */
  next: number;
  more: boolean;
}

export interface AttemptsPage {
  attempts: (ProgressAttempt & { seq: number })[];
  next: number;
  more: boolean;
}

/** What the next melody is picked against. */
export interface TuneHistory {
  /** Tunes ever played at 100%. */
  mastered: string[];
  /** Tune ids of the latest attempts, oldest first. */
  recent: string[];
}

/** How many of the latest attempts `TuneHistory.recent` holds. */
export const RECENT_LIMIT = 50;

export interface ProgressStore {
  /** Stores the attempt; an id the account already has is ignored. */
  addAttempt(userId: string, attempt: ProgressAttempt): Promise<void>;
  history(userId: string): Promise<TuneHistory>;
  getDifficulty(userId: string): Promise<ProgressDifficulty | null>;
  /** Replaces the account's difficulty state. */
  putDifficulty(userId: string, difficulty: ProgressDifficulty, now: Date): Promise<void>;
  /** Saves a place unless the account already has a newer write (or delete) for the tune. True when stored. */
  putMelody(userId: string, place: MelodyPlace): Promise<boolean>;
  /** The account's places, tunes in any order. Deleted ones are not listed. */
  listMelodies(userId: string): Promise<MelodyPlace[]>;
  /**
   * Stores rows an account earned; a row already there (same kind and id) is left as it is, except mastery, where the
   * earlier `achievedAt` wins (and the row is then pulled again by devices that had the later one).
   */
  putGameRows(userId: string, rows: GameRowInput[]): Promise<void>;
  /** Up to `limit` rows after the cursor, in the order they arrived. */
  gameRowsAfter(userId: string, after: number, limit: number): Promise<GamePage>;
  /** Up to `limit` of the account's attempts after the cursor, in the order they arrived, with their note results. */
  attemptsAfter(userId: string, after: number, limit: number): Promise<AttemptsPage>;
  /** Removes a place (the melody was finished) unless a newer write exists. The delete is remembered. */
  deleteMelody(userId: string, tuneId: string, updatedAt: Date): Promise<void>;
}
