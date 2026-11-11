// Runs the sync steps (spec 019) one after another, at most once a minute unless something was just earned, and
// never twice at once: a request made while a run is going shares that run. A step that fails does not stop the
// ones after it; the next run tries again. Resolves with whether any step brought something new to this device.

/** A sync step: true when it brought something new here. */
export type SyncStep = () => Promise<boolean | void>;

export interface SyncRunner {
  request(opts?: { force?: boolean }): Promise<boolean>;
}

export function createSyncRunner({
  steps,
  minIntervalMs = 60_000,
  now = () => Date.now(),
}: {
  steps: readonly SyncStep[];
  minIntervalMs?: number;
  now?: () => number;
}): SyncRunner {
  let running: Promise<boolean> | null = null;
  let lastEnd = -Infinity;

  async function run(): Promise<boolean> {
    let changed = false;
    for (const step of steps) {
      try {
        changed = (await step()) === true || changed;
      } catch {
        // the next run tries again
      }
    }
    lastEnd = now();
    return changed;
  }

  return {
    request(opts) {
      if (running) return running;
      if (!opts?.force && now() - lastEnd < minIntervalMs) return Promise.resolve(false);
      running = run().finally(() => {
        running = null;
      });
      return running;
    },
  };
}
