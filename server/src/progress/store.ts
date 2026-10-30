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
}
