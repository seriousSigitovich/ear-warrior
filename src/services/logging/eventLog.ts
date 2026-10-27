// Product events for the closed beta: did a tester open the app, finish onboarding, start and end a
// practice session — and on which day. Same shape as the attempt log: anonymous (a random per-install
// device id, no audio, no PII), best-effort, with an offline outbox so it never blocks the app.
// The transport client is injected so queue/flush/retry logic is testable against a mock.

/** The beta's one question: do testers come back? Day-2 return and sessions per week fall out of these four. */
export type AppEventName = 'app_open' | 'onboarding_done' | 'session_start' | 'session_end';

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
      if (!res.ok) throw new Error(`event log failed: ${res.status}`);
    },
  };
}

export function createAppEventOutbox(
  client: AppEventClient,
  queue: AppEventPayload[] = [],
): AppEventOutbox {
  async function flush(): Promise<void> {
    while (queue.length > 0) {
      try {
        await client.insert(queue[0]);
        queue.shift();
      } catch {
        break; // still unreachable; retry on the next log
      }
    }
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
