// Server/local error code -> plain-language copy: what happened and what to do next (Constitution III,
// FR-019). Table: contracts/client-auth.md.
import type { AuthError } from './client';

export interface ErrorCopy {
  title: string;
  hint: string;
}

const NEW_CODE = 'Tap "Send a new code".';
const OFFLINE: ErrorCopy = {
  title: "Can't reach the server",
  hint: 'You can keep practising; try signing in later.',
};
const OUR_SIDE: ErrorCopy = {
  title: 'Something went wrong on our side',
  hint: 'Try again in a minute. You can keep practising.',
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function describeError(error: AuthError): ErrorCopy {
  switch (error.code) {
    case 'invalid_email':
    case 'invalid_payload':
      return {
        title: "That doesn't look like an email",
        hint: 'Check for typos, e.g. name@gmail.com.',
      };
    case 'rate_limited': {
      const minutes = Math.max(1, Math.ceil((error.retryAfterS ?? 60) / 60));
      return {
        title: 'Too many codes requested',
        hint: `Try again in ${plural(minutes, 'minute')}.`,
      };
    }
    case 'mail_failed':
      return {
        title: "We couldn't send the email",
        hint: 'Check your connection and tap "Send again".',
      };
    case 'wrong_code':
      return {
        title: "That code isn't right",
        hint: `${plural(error.attemptsLeft ?? 0, 'attempt')} left — check the latest email.`,
      };
    case 'code_expired':
      return { title: 'That code has expired', hint: NEW_CODE };
    case 'too_many_attempts':
      return { title: 'Too many wrong tries', hint: NEW_CODE };
    case 'no_code':
      return { title: 'There is no active code for this email', hint: NEW_CODE };
    case 'invalid_session':
      return {
        title: 'You were signed out',
        hint: 'Sign in again whenever you like. Practice works without it.',
      };
    case 'network':
    case 'auth_disabled':
      return OFFLINE;
    case 'store_failed':
    case 'server_error':
      return OUR_SIDE;
  }
}
