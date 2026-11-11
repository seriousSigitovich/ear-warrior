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
  /** Removes a place (the melody was finished) unless a newer write exists. The delete is remembered. */
  deleteMelody(userId: string, tuneId: string, updatedAt: Date): Promise<void>;
}
