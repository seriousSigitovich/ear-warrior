// Local persistence port (R8). Repositories depend on a small `RowStore` port; the SQLite adapter is
// the on-device implementation, and an in-memory implementation backs tests and an offline fallback.
// This keeps repository logic testable without a native SQLite engine.

export const SESSIONS_TABLE = 'sessions';
export const ATTEMPTS_TABLE = 'attempts';
/** Singleton row holding the learner's difficulty state (FR-011b). */
export const DIFFICULTY_SETTINGS_TABLE = 'difficulty_settings';

/** Every table the app creates on open. */
export const ALL_TABLES = [SESSIONS_TABLE, ATTEMPTS_TABLE, DIFFICULTY_SETTINGS_TABLE];

/** Minimal document store keyed by string id. The SQLite adapter serializes rows as JSON docs. */
export interface RowStore {
  insert(table: string, id: string, row: Record<string, unknown>): Promise<void>;
  update(table: string, id: string, patch: Record<string, unknown>): Promise<void>;
  getById<T>(table: string, id: string): Promise<T | null>;
  all<T>(table: string): Promise<T[]>;
}

/** In-memory RowStore — used by tests and as an offline-safe fallback. */
export function createInMemoryRowStore(): RowStore {
  const tables = new Map<string, Map<string, Record<string, unknown>>>();
  const tableOf = (name: string) => {
    let t = tables.get(name);
    if (!t) {
      t = new Map();
      tables.set(name, t);
    }
    return t;
  };
  return {
    async insert(table, id, row) {
      tableOf(table).set(id, { ...row });
    },
    async update(table, id, patch) {
      const existing = tableOf(table).get(id);
      if (existing) {
        tableOf(table).set(id, { ...existing, ...patch });
      }
    },
    async getById<T>(table: string, id: string) {
      return (tableOf(table).get(id) as T) ?? null;
    },
    async all<T>(table: string) {
      return Array.from(tableOf(table).values()) as T[];
    },
  };
}

/**
 * Real expo-sqlite RowStore (lazily required; never loaded under the pure-logic test runner).
 * Stores each row as a JSON document (`id TEXT PRIMARY KEY, data TEXT`) so it survives app restarts
 * (FR-013, interrupted-session edge case). NOTE: US3 aggregate reporting migrates these to typed
 * columns; confirmed on-device during the spike.
 */
export function defaultRowStore(): RowStore {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const SQLite = require('expo-sqlite');
  const dbPromise = SQLite.openDatabaseAsync('ear-warrior.db').then(async (db: any) => {
    for (const table of ALL_TABLES) {
      await db.execAsync(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, data TEXT);`);
    }
    return db;
  });
  return {
    async insert(table, id, row) {
      const db = await dbPromise;
      await db.runAsync(`INSERT OR REPLACE INTO ${table} (id, data) VALUES (?, ?)`, [
        id,
        JSON.stringify(row),
      ]);
    },
    async update(table, id, patch) {
      const db = await dbPromise;
      const current = await db.getFirstAsync(`SELECT data FROM ${table} WHERE id = ?`, [id]);
      if (current) {
        const merged = { ...JSON.parse(current.data), ...patch };
        await db.runAsync(`UPDATE ${table} SET data = ? WHERE id = ?`, [JSON.stringify(merged), id]);
      }
    },
    async getById<T>(table: string, id: string) {
      const db = await dbPromise;
      const row = await db.getFirstAsync(`SELECT data FROM ${table} WHERE id = ?`, [id]);
      return row ? (JSON.parse(row.data) as T) : null;
    },
    async all<T>(table: string) {
      const db = await dbPromise;
      const rows = await db.getAllAsync(`SELECT data FROM ${table}`);
      return rows.map((r: { data: string }) => JSON.parse(r.data) as T);
    },
  };
}
