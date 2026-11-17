// Runs the shared ledger contract against a real Postgres (DATABASE_URL, default: the docker-compose one).
// Skipped, not failed, when no database is reachable, so `npm test` stays green on a bare machine.
import { after } from 'node:test';
import { db, sql } from '../db/client.js';
import { applyDdl } from '../db/ddl.js';
import { createPgLedgerStore } from './ledgerPgStore.js';
import { runLedgerContract } from './ledger.contract.js';

// The suite truncates tables and creates users, so it only ever touches a local database.
const url = process.env.DATABASE_URL ?? 'postgres://localhost';
let skip: string | undefined = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url) || !url.includes('@') ? undefined : 'DATABASE_URL is not local';
if (!skip) {
  try {
    await applyDdl(sql);
  } catch (err) {
    skip = `no Postgres reachable (${(err as Error).message.slice(0, 60)})`;
  }
}

let seq = 0;
runLedgerContract(
  'postgres',
  async () => {
    await sql.unsafe('truncate users, phrase_checks, phrase_events, xp_ledger, daily_xp restart identity cascade');
    return {
      store: createPgLedgerStore(db),
      newUser: async () => {
        const [row] = await sql`insert into users (email) values (${`ledger${++seq}@x.co`}) returning id`;
        return row.id as string;
      },
    };
  },
  { skip },
);

after(() => sql.end({ timeout: 2 }));
