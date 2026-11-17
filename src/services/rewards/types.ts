// What the server says about a learner's rewards (spec 024) and the app's view of it. The app computes none of it:
// XP, rank, streak and challenges arrive ready, and the screens draw them.
import type { NoteResult } from '../../models';

export interface RankRef {
  id: string;
  name: string;
  /** Total XP at which the rank is reached. */
  xp: number;
}

export interface RankView {
  id: string;
  name: string;
  index: number;
  /** The rank above; null at the top. */
  next: RankRef | null;
  /** XP still needed for the next rank (0 at the top). */
  xpToNext: number;
  /** 0–100 through this rank towards the next one. */
  pct: number;
}

export interface ChallengeView {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  rewardXp: number;
  completed: boolean;
}

/** Everything the Home, Progress, Journey and Challenges screens show. */
export interface RewardsView {
  totalXp: number;
  rank: RankView;
  /** Every rank with its XP threshold (the ranks list); empty until the server has said. */
  ranks: RankRef[];
  streak: { days: number; practicedToday: boolean };
  /** The local day this is for. */
  today: string;
  /** Local days with any XP in the last fortnight, for the week strip. */
  activeDays: ReadonlySet<string>;
  challenges: ChallengeView[];
  allChallengesDone: boolean;
  /** What finishing all of the day's challenges pays on top. */
  dailyBonusXp: number;
}

export interface PayoutView {
  paid: boolean;
  xp: number;
  base: number;
  levelMult: number;
  attemptNo: number;
  attemptFactor: number;
  hintFactor: number;
  capFactor: number;
  /** Why a passed phrase paid 0 (or a failed one nothing); null when it paid. */
  reason: 'below_pass' | 'answer_shown' | 'attempts' | 'already_paid' | null;
}

export interface GradeView {
  accuracy: number;
  passed: boolean;
  verdict: 'correct' | 'incorrect';
  noteResults: NoteResult[];
}

/** The answer to one phrase check. */
export interface PhraseResult {
  grade: GradeView;
  payout: PayoutView;
  /** The check had been sent before: nothing was paid again. */
  replay: boolean;
  view: RewardsView;
  rankUp: { id: string; name: string } | null;
  /** This check was the first XP of the local day: the streak grew. */
  streakExtended: boolean;
  challengesPaid: { id: string; rewardXp: number }[];
  allBonusXp: number;
}

/** One phrase check as the device sends it. */
export interface CheckInput {
  tuneId: string;
  phrase: number;
  /** Midi of the tapped notes, in order. */
  played: number[];
}

export interface QueuedCheck {
  checkId: string;
  tuneId: string;
  phrase: number;
  played: number[];
  checkedAt: string;
  localDay: string;
}

export type CheckOutcome =
  | { kind: 'graded'; result: PhraseResult }
  /** No answer yet (no network): the check is kept and sent when it can be; the result arrives through `onResult`. */
  | { kind: 'queued'; checkId: string }
  /** The server will never accept this check (unknown tune or phrase): nothing was kept. */
  | { kind: 'rejected' };
