// Runs the shared store contract against a real Postgres (DATABASE_URL, default: the docker-compose one).
// Skipped, not failed, when no database is reachable, so `npm test` stays green on a bare machine.
import { after } from 'node:test';
import { db, sql } from '../db/client.js';
import { applyDdl } from '../db/ddl.js';
import { createPgStore } from './pgStore.js';
import { runStoreContract } from './store.contract.js';

// The suite truncates the auth tables, so it only ever touches a database on this machine.
const url = process.env.DATABASE_URL ?? 'postgres://localhost';
let skip: string | undefined = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url) || !url.includes('@') ? undefined : 'DATABASE_URL is not local';
if (!skip) {
  try {
    await applyDdl(sql);
  } catch (err) {
    skip = `no Postgres reachable (${(err as Error).message.slice(0, 60)})`;
  }
}

runStoreContract(
  'postgres',
  async () => {
    await sql.unsafe('truncate users, login_codes, auth_sessions, device_links restart identity cascade');
    return createPgStore(db);
  },
  { skip },
);

after(() => sql.end({ timeout: 2 }));
