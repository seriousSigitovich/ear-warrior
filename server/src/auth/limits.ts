// Rate-limit decisions as a pure function of the request log and the clock (R4). The counts come from
// Postgres, not memory: the API runs as stateless serverless instances.
import { EMAIL_REQUESTS_PER_HOUR, RESEND_AFTER_S, SOURCE_REQUESTS_PER_HOUR, WINDOW_S } from './policy.js';

export type Decision = { allow: true } | { allow: false; retryAfterS: number };

interface Input {
  /** Timestamps of code requests for this address within the last hour. */
  emailRequests: Date[];
  /** Timestamps of code requests from this source within the last hour. */
  sourceRequests: Date[];
  now: Date;
}

/** Seconds until at most `limit - 1` of the requests remain inside the window (0 when already under). */
function waitForWindow(requests: Date[], limit: number, now: Date): number {
  if (requests.length < limit) return 0;
  const sorted = requests.map((d) => d.getTime()).sort((a, b) => a - b);
  const mustLeave = sorted[sorted.length - limit];
  return Math.ceil((mustLeave + WINDOW_S * 1000 - now.getTime()) / 1000);
}

export function decideRequest({ emailRequests, sourceRequests, now }: Input): Decision {
  const newest = emailRequests.reduce((max, d) => Math.max(max, d.getTime()), -Infinity);
  const resend = emailRequests.length ? Math.ceil((newest + RESEND_AFTER_S * 1000 - now.getTime()) / 1000) : 0;
  const retryAfterS = Math.max(
    resend,
    waitForWindow(emailRequests, EMAIL_REQUESTS_PER_HOUR, now),
    waitForWindow(sourceRequests, SOURCE_REQUESTS_PER_HOUR, now),
  );
  return retryAfterS > 0 ? { allow: false, retryAfterS } : { allow: true };
}
