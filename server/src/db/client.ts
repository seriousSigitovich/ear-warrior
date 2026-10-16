// Postgres connection + Drizzle handle. A single shared pool for the process.
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';
import { applyDdl } from './ddl.js';

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgres://ear_warrior:ear_warrior@localhost:5432/ear_warrior';

// One pooled client for the whole app. `max` kept modest for a small service.
// `onnotice` silences the "relation already exists, skipping" notices that the idempotent boot DDL
// (`create ... if not exists`) makes Postgres print on every start.
export const sql = postgres(DATABASE_URL, { max: 10, onnotice: () => {} });
export const db = drizzle(sql, { schema });

/** Ensure the schema exists. Called once at startup. */
export async function initDb(): Promise<void> {
  await applyDdl(sql);
}
