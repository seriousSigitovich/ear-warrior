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
// Serverless (Vercel) opens a pool per instance, so DB_POOL_MAX=1 there; behind a transaction pooler
// (Neon's pooled URL, pgbouncer) prepared statements are unsupported, so DB_PREPARE=false.
export const sql = postgres(DATABASE_URL, {
  max: Number(process.env.DB_POOL_MAX ?? 10),
  prepare: process.env.DB_PREPARE !== 'false',
  onnotice: () => {},
});
export const db = drizzle(sql, { schema });

/** Ensure the schema exists. Called once at startup. */
export async function initDb(): Promise<void> {
  await applyDdl(sql);
}
