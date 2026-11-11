// Keeps the reward system's rows in step with the server (spec 019). Awards, completions and mastery are
// append-only rows with deterministic ids (spec 013), so combining two devices is a union by kind and id — except
// mastery, where the earlier date wins. A row made here carries no flag until the server has accepted it; the
// server's rows are pulled after a cursor and added when missing. Anonymous learners (or a build without a server)
// sync nothing; what they earned goes up once they sign in. Never throws.
import {
  COMPLETIONS_TABLE,
  GAMIFICATION_META_TABLE,
  MASTERY_TABLE,
  RowStore,
  XP_AWARDS_TABLE,
} from '../storage/db';
import type { GameRow, ProgressClient } from '../progress/client';

interface Deps {
  store: RowStore;
  client: ProgressClient;
  /** The signed-in session's token, or null when anonymous. */
  getToken: () => Promise<string | null>;
}

export interface GameSync {
  /** Send what the server lacks, then take what this device lacks. True when new rows arrived here. */
  sync(): Promise<boolean>;
}

const TABLE_OF: Record<GameRow['kind'], string> = {
  award: XP_AWARDS_TABLE,
  completion: COMPLETIONS_TABLE,
  mastery: MASTERY_TABLE,
};
const CURSOR_ID = 'sync-cursor';
const BATCH = 200;
const MAX_PAGES = 50;

type Doc = Record<string, unknown> & { id: string; synced?: boolean };

export function createGameSync({ store, client, getToken }: Deps): GameSync {
  // One at a time: two runs at once would send the same rows twice.
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = chain.then(task, task);
    chain = run.catch(() => undefined);
    return run;
  };

  /** Rows made here that the server has not accepted (rows from before sync existed have no flag). */
  async function unsent(): Promise<GameRow[]> {
    const rows: GameRow[] = [];
    for (const kind of Object.keys(TABLE_OF) as GameRow['kind'][]) {
      for (const doc of await store.all<Doc>(TABLE_OF[kind])) {
        if (doc.synced === true) continue;
        const data: Record<string, unknown> = { ...doc };
        delete data.synced; // the flag is this device's own
        rows.push({ kind, id: doc.id, data });
      }
    }
    return rows;
  }

  async function push(token: string): Promise<boolean> {
    const rows = await unsent();
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      if (!(await client.pushGame(token, batch))) return false;
      for (const r of batch) await store.update(TABLE_OF[r.kind], r.id, { synced: true });
    }
    return true;
  }

  /** Add a pulled row when this device lacks it (mastery: when it is earlier). True when the device changed. */
  async function apply(row: GameRow): Promise<boolean> {
    const table = TABLE_OF[row.kind];
    const have = await store.getById<Doc>(table, row.id);
    const earlier =
      row.kind === 'mastery' && have && String(row.data.achievedAt) < String(have.achievedAt);
    if (have && !earlier) return false;
    await store.insert(table, row.id, { ...row.data, id: row.id, synced: true });
    return true;
  }

  async function pull(token: string): Promise<boolean> {
    const saved = await store.getById<{ seq: number }>(GAMIFICATION_META_TABLE, CURSOR_ID);
    let after = saved?.seq ?? 0;
    let changed = false;
    for (let page = 0; page < MAX_PAGES; page++) {
      const got = await client.pullGame(token, after);
      if (!got) break;
      for (const row of got.rows) changed = (await apply(row)) || changed;
      after = got.next;
      await store.insert(GAMIFICATION_META_TABLE, CURSOR_ID, { id: CURSOR_ID, seq: after });
      if (!got.more) break;
    }
    return changed;
  }

  return {
    sync: () =>
      serial(async () => {
        try {
          const token = await getToken();
          if (!token) return false;
          if (!(await push(token))) return false;
          return await pull(token);
        } catch {
          return false; // a failed sync must never reach a screen; the next run retries
        }
      }),
  };
}
