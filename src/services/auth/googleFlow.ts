// Google sign-in screen logic (spec 022, contracts/client-google.md): a pure state machine and the parser of
// the `earwarrior://sign-in` return link. The screen performs the IO each transition asks for.
import type { AuthError, Result } from './client';

export type GoogleState =
  | { step: 'idle'; error?: AuthError }
  | { step: 'starting' }
  | { step: 'waiting' }
  | { step: 'exchanging' }
  | { step: 'done'; email: string };

export type ReturnErrorCode =
  'cancelled' | 'unverified_email' | 'expired' | 'google_failed' | 'google_disabled';
export type GoogleReturn =
  { kind: 'ticket'; ticket: string } | { kind: 'error'; code: ReturnErrorCode };

export type GoogleEvent =
  | { type: 'tap' }
  | { type: 'started'; result: Result<void> }
  | { type: 'returned'; link: GoogleReturn }
  | { type: 'exchanged'; result: Result<{ email: string; created: boolean }> };

const ERROR_CODES: ReadonlySet<string> = new Set<ReturnErrorCode>([
  'cancelled',
  'unverified_email',
  'expired',
  'google_failed',
  'google_disabled',
]);
const TICKET = /^[A-Za-z0-9_-]{20,100}$/;

type Param = string | string[] | undefined;
const first = (p: Param): string | undefined => (Array.isArray(p) ? p[0] : p);

/** The return link's query, or null when it is absent, unknown, oversized or ambiguous (never trust a link). */
export function parseGoogleReturn(params: { ticket?: Param; error?: Param }): GoogleReturn | null {
  const ticket = first(params.ticket);
  const error = first(params.error);
  if (ticket !== undefined && error !== undefined) return null;
  if (ticket !== undefined) return TICKET.test(ticket) ? { kind: 'ticket', ticket } : null;
  if (error !== undefined && ERROR_CODES.has(error))
    return { kind: 'error', code: error as ReturnErrorCode };
  return null;
}

export const initialGoogle = (): GoogleState => ({ step: 'idle' });

export function reduceGoogle(state: GoogleState, event: GoogleEvent): GoogleState {
  switch (event.type) {
    case 'tap':
      // Busy: ignore. Waiting: the browser may have been closed, so a second tap starts over.
      return state.step === 'idle' || state.step === 'waiting' ? { step: 'starting' } : state;
    case 'started':
      if (state.step !== 'starting') return state;
      return event.result.ok ? { step: 'waiting' } : { step: 'idle', error: event.result.error };
    case 'returned':
      if (state.step !== 'idle' && state.step !== 'waiting') return state;
      if (event.link.kind === 'ticket') return { step: 'exchanging' };
      return event.link.code === 'cancelled'
        ? { step: 'idle' }
        : { step: 'idle', error: { code: event.link.code } };
    case 'exchanged':
      if (state.step !== 'exchanging') return state;
      if (event.result.ok) return { step: 'done', email: event.result.value.email };
      return {
        step: 'idle',
        error: {
          code: event.result.error.code === 'invalid_ticket' ? 'expired' : event.result.error.code,
        },
      };
  }
}
