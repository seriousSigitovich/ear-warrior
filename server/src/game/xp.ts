// What a passing phrase pays (spec 024, FR-008–FR-012). Pure: the numbers come from config.ts, the facts (attempt
// number, hints, base XP already used today) from the ledger.
//
//   base      = 10, +5 at ≥ 90 %, +5 at 100 %
//   practised = base × attempt factor × hint factor        (what counts toward the daily cap)
//   capped    = the part of `practised` under the cap in full, the rest at the overflow factor
//   xp        = round(capped × level multiplier)
import {
  ANSWER_FACTOR,
  ATTEMPT_FACTOR,
  CAP_OVERFLOW_FACTOR,
  DAILY_CAP_BASE,
  HINT_FACTOR,
  LEVEL_MULT,
  PASS_ACCURACY,
  PHRASE_XP,
} from './config.js';

export interface PayoutInput {
  /** Percent of the phrase's notes landed, 0–100. */
  accuracy: number;
  /** Difficulty level of the tune, 1–9. */
  level: number;
  /** 1 for the first check of this phrase by the account, 2 for the second, … */
  attemptNo: number;
  /** The first-note hint was taken before this check. */
  hint: boolean;
  /** The answer was shown before this check. */
  answerShown: boolean;
  /** Base XP already counted toward today's cap. */
  baseUsedToday: number;
}

export type PayoutReason = 'below_pass' | 'answer_shown' | 'attempts' | 'already_paid' | null;

export interface Payout {
  /** XP for the account; 0 when the phrase passed but pays nothing (see `reason`). */
  xp: number;
  /** The phrase counts as passed (accuracy at or above the pass mark): it is closed and never pays again. */
  passed: boolean;
  base: number;
  level_mult: number;
  attempt_no: number;
  attempt_factor: number;
  hint_factor: number;
  cap_factor: number;
  /** Why it pays 0 although it may have passed; null when it paid. */
  reason: PayoutReason;
  /** What to add to today's cap counter (the practised base, before the level multiplier). */
  capBase: number;
}

export const phraseBase = (accuracy: number): number =>
  PHRASE_XP.base + (accuracy >= 90 ? PHRASE_XP.accuracy90 : 0) + (accuracy >= 100 ? PHRASE_XP.accuracy100 : 0);

export function payout(input: PayoutInput): Payout {
  const levelMult = LEVEL_MULT[Math.min(Math.max(input.level, 1), LEVEL_MULT.length) - 1];
  const attemptFactor = ATTEMPT_FACTOR[Math.min(Math.max(input.attemptNo, 1), ATTEMPT_FACTOR.length) - 1];
  const hintFactor = input.answerShown ? ANSWER_FACTOR : input.hint ? HINT_FACTOR : 1;
  const none = {
    base: 0,
    level_mult: levelMult,
    attempt_no: input.attemptNo,
    attempt_factor: attemptFactor,
    hint_factor: hintFactor,
    cap_factor: 1,
    capBase: 0,
  };
  if (!Number.isFinite(input.accuracy) || input.accuracy < PASS_ACCURACY) {
    return { ...none, xp: 0, passed: false, reason: 'below_pass' };
  }

  const base = phraseBase(input.accuracy);
  const practised = base * attemptFactor * hintFactor;
  const room = Math.max(0, DAILY_CAP_BASE - input.baseUsedToday);
  const full = Math.min(practised, room);
  const capped = full + (practised - full) * CAP_OVERFLOW_FACTOR;
  const xp = Math.round(capped * levelMult);
  const reason: PayoutReason = xp > 0 ? null : input.answerShown ? 'answer_shown' : attemptFactor === 0 ? 'attempts' : null;
  return {
    xp,
    passed: true,
    base,
    level_mult: levelMult,
    attempt_no: input.attemptNo,
    attempt_factor: attemptFactor,
    hint_factor: hintFactor,
    cap_factor: practised === 0 ? 1 : capped / practised,
    reason,
    capBase: practised,
  };
}

/** The payout of a check on a phrase the account already passed: nothing, ever again. */
export const alreadyPaid = (attemptNo: number): Payout => ({
  xp: 0,
  passed: true,
  base: 0,
  level_mult: 1,
  attempt_no: attemptNo,
  attempt_factor: 0,
  hint_factor: 1,
  cap_factor: 1,
  reason: 'already_paid',
  capBase: 0,
});
