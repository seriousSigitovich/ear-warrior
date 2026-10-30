// Runs the shared progress contract against a real Postgres (DATABASE_URL, default: the docker-compose one).
// Skipped, not failed, when no database is reachable, so `npm test` stays green on a bare machine.
import { after } from 'node:test';
import { db, sql } from '../db/client.js';
import { applyDdl } from '../db/ddl.js';
import { createPgProgressStore } from './pgStore.js';
import { runProgressContract } from './store.contract.js';

// The suite truncates the progress tables and creates users, so it only ever touches a local database.
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
runProgressContract(
  'postgres',
  async () => {
    await sql.unsafe('truncate users, progress_attempts, progress_difficulty restart identity cascade');
    return {
      store: createPgProgressStore(db),
      newUser: async () => {
        const [row] = await sql`insert into users (email) values (${`progress${++seq}@x.co`}) returning id`;
        return row.id as string;
      },
    };
  },
  { skip },
);

after(() => sql.end({ timeout: 2 }));
