// The sign-in screen as a pure state machine (R13): email -> code -> done, with resend cooldown and
// attempts-left bookkeeping over an injected clock. The .tsx screen only renders it and performs the
// IO each transition asks for. Diagram: contracts/client-auth.md.
import { isPlausibleEmail, normalizeEmail } from '../../lib/email';
import type { AuthError, Result } from './client';

export type CodeStep = {
  step: 'code';
  email: string;
  /** Epoch ms from which "Send again" is allowed. */
  resendAt: number;
  expiresAt: number;
  /** The code is dead (expired / used up / missing): only a new one helps. */
  needsNewCode: boolean;
  attemptsLeft?: number;
  error?: AuthError;
};

export type FlowState =
  | { step: 'email'; email: string; error?: AuthError }
  | { step: 'requesting'; email: string; previous?: CodeStep }
  | CodeStep
  | { step: 'verifying'; email: string; previous: CodeStep }
  | { step: 'done'; email: string }
  | { step: 'dismissed' };

export type FlowEvent =
  | { type: 'submit_email'; email: string }
  | { type: 'request_done'; result: Result<{ resendAfterS: number; expiresInS: number }> }
  | { type: 'resend' }
  | { type: 'submit_code'; code: string }
  | { type: 'verify_done'; result: Result<{ token: string; email: string; created: boolean }> }
  | { type: 'change_email' }
  | { type: 'skip' };

export const initialFlow = (lastEmail = ''): FlowState => ({ step: 'email', email: lastEmail });

/**
 * The code step as stored on the device, so leaving the screen after "Send code" and coming back does not
 * show the email field again (a second request inside the resend window gets `rate_limited`).
 */
export type PendingCode = Pick<CodeStep, 'email' | 'resendAt' | 'expiresAt' | 'needsNewCode' | 'attemptsLeft'>;

export const toPending = (s: CodeStep): PendingCode => ({
  email: s.email,
  resendAt: s.resendAt,
  expiresAt: s.expiresAt,
  needsNewCode: s.needsNewCode,
  attemptsLeft: s.attemptsLeft,
});

export const serializePending = (p: PendingCode): string => JSON.stringify(p);

/** The stored code step if it is still worth showing: well-formed and its code not yet expired. */
export function parsePending(raw: string | null, now: number): CodeStep | null {
  if (!raw) return null;
  let p: Partial<PendingCode>;
  try {
    p = JSON.parse(raw) as Partial<PendingCode>;
  } catch {
    return null;
  }
  if (
    !p ||
    typeof p.email !== 'string' ||
    typeof p.resendAt !== 'number' ||
    typeof p.expiresAt !== 'number' ||
    typeof p.needsNewCode !== 'boolean' ||
    p.expiresAt <= now
  ) {
    return null;
  }
  return {
    step: 'code',
    email: p.email,
    resendAt: p.resendAt,
    expiresAt: p.expiresAt,
    needsNewCode: p.needsNewCode,
    attemptsLeft: typeof p.attemptsLeft === 'number' ? p.attemptsLeft : undefined,
  };
}

export const isSixDigits = (code: string): boolean => /^[0-9]{6}$/.test(code);

/** Whole seconds until "Send again" unlocks; 0 when it already has (or there is no code step). */
export function resendSecondsLeft(state: FlowState, now: number): number {
  return state.step === 'code' ? Math.max(0, Math.ceil((state.resendAt - now) / 1000)) : 0;
}

const DEAD_CODE: ReadonlySet<string> = new Set(['code_expired', 'too_many_attempts', 'no_code']);

export function reduce(state: FlowState, event: FlowEvent, now: number): FlowState {
  if (event.type === 'skip') return { step: 'dismissed' };

  switch (state.step) {
    case 'email': {
      if (event.type !== 'submit_email') return state;
      const email = normalizeEmail(event.email);
      return isPlausibleEmail(email)
        ? { step: 'requesting', email }
        : { step: 'email', email: event.email, error: { code: 'invalid_email' } };
    }

    case 'requesting': {
      if (event.type !== 'request_done') return state;
      const { result } = event;
      if (result.ok) {
        return {
          step: 'code',
          email: state.email,
          resendAt: now + result.value.resendAfterS * 1000,
          expiresAt: now + result.value.expiresInS * 1000,
          needsNewCode: false,
        };
      }
      // A failed resend keeps the code step: the previous code may still be valid.
      if (state.previous) {
        const wait =
          result.error.code === 'rate_limited' && result.error.retryAfterS
            ? now + result.error.retryAfterS * 1000
            : state.previous.resendAt;
        return { ...state.previous, resendAt: wait, error: result.error };
      }
      return { step: 'email', email: state.email, error: result.error };
    }

    case 'code': {
      if (event.type === 'change_email') return { step: 'email', email: state.email };
      if (event.type === 'resend') {
        return now >= state.resendAt
          ? { step: 'requesting', email: state.email, previous: state }
          : state;
      }
      if (event.type === 'submit_code') {
        return state.needsNewCode || !isSixDigits(event.code)
          ? state
          : { step: 'verifying', email: state.email, previous: state };
      }
      return state;
    }

    case 'verifying': {
      if (event.type !== 'verify_done') return state;
      const { result } = event;
      if (result.ok) return { step: 'done', email: result.value.email };
      const { error } = result;
      if (error.code === 'wrong_code')
        return { ...state.previous, attemptsLeft: error.attemptsLeft, error };
      if (DEAD_CODE.has(error.code))
        return { ...state.previous, needsNewCode: true, attemptsLeft: undefined, error };
      return { ...state.previous, error }; // network / server trouble: the code stays valid, entry can resume
    }

    default:
      return state;
  }
}
