// Product events for the closed beta: did a tester open the app, how far they got through onboarding,
// sign-in and the first melody, and where they were when they left — and on which day. Same shape as the attempt log: anonymous (a random per-install
// device id, no audio, no PII), best-effort, with an offline outbox so it never blocks the app.
// The transport client is injected so queue/flush/retry logic is testable against a mock.

/**
 * Two questions: do testers come back (app_open, app_resume, sessions), and where does a first run stop
 * (the onboarding, sign-in and practice steps, and the screen an `app_background` was sent from).
 * Matches the server's EventBody enum (server/src/routes/events.ts): ship the server first.
 */
export type AppEventName =
  | 'app_open'
  | 'app_resume'
  | 'app_background'
  | 'screen_view'
  | 'onboarding_step'
  | 'onboarding_done'
  | 'signin_code_request'
  | 'signin_error'
  | 'signin_done'
  | 'signin_skip'
  | 'session_start'
  | 'melody_play'
  | 'melody_replay'
  | 'answer_start'
  | 'answer_check'
  | 'draft_on'
  | 'session_end';

/** A route as the funnel names it: `/` → `home`, `/sign-in` → `sign_in`. Pure. */
export function screenFromPath(pathname: string): string {
  const name = pathname
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-z0-9]+/gi, '_')
    .toLowerCase();
  return name === '' ? 'home' : name.slice(0, 40);
}

export interface AppEventPayload {
  device_id: string;
  app_version: string;
  name: AppEventName;
  /** Client clock, ISO 8601 — events may be flushed long after they happened. */
  occurred_at: string;
  /** Small scalar details, e.g. `attempt_count` on `session_end`. */
  props: Record<string, number | string | boolean>;
}

export interface AppEventClient {
  insert(row: AppEventPayload): Promise<void>;
}

/** Build the payload for one event. Pure. */
export function buildEventPayload(
  name: AppEventName,
  deviceId: string,
  appVersion: string,
  now: Date,
  props: Record<string, number | string | boolean> = {},
): AppEventPayload {
  return {
    device_id: deviceId,
    app_version: appVersion,
    name,
    occurred_at: now.toISOString(),
    props,
  };
}

export interface AppEventOutbox {
  /** Best-effort log; queues locally on failure and NEVER throws to the caller. */
  log(payload: AppEventPayload): Promise<void>;
  /** Attempt to insert all queued payloads; stops (keeping the rest) on the first failure. */
  flush(): Promise<void>;
  /** Number of payloads currently queued. */
  pending(): number;
}

/** Path the events are POSTed to on the Ear Warrior backend. */
export const APP_EVENT_PATH = '/api/events';

/** Real HTTP-backed client. Null when no API base URL is configured, so the app simply logs nothing. */
export function defaultAppEventClient(baseUrl?: string): AppEventClient | null {
  if (!baseUrl) return null;
  const endpoint = `${baseUrl.replace(/\/$/, '')}${APP_EVENT_PATH}`;
  return {
    async insert(row) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row),
      });
      // A 4xx will never be accepted (e.g. a name an older server does not know): drop it rather than
      // let it block the queue forever. Only network errors and 5xx are worth retrying.
      if (res.status >= 400 && res.status < 500) return;
      if (!res.ok) throw new Error(`event log failed: ${res.status}`);
    },
  };
}

export function createAppEventOutbox(
  client: AppEventClient,
  queue: AppEventPayload[] = [],
): AppEventOutbox {
  async function drain(): Promise<void> {
    while (queue.length > 0) {
      try {
        await client.insert(queue[0]);
        queue.shift();
      } catch {
        break; // still unreachable; retry on the next log
      }
    }
  }
  // One drain at a time. Two concurrent drains both sent queue[0] (a duplicate row) and then both
  // shifted, dropping an event nobody had sent — seen as app_open ×4 in prod. A log made mid-drain
  // joins the running one, whose loop picks the new payload up.
  let running: Promise<void> | null = null;
  function flush(): Promise<void> {
    running ??= drain().finally(() => {
      running = null;
    });
    return running;
  }
  return {
    async log(payload) {
      queue.push(payload);
      // Flushing on every log also retries whatever an earlier offline moment left behind.
      await flush();
    },
    flush,
    pending: () => queue.length,
  };
}
