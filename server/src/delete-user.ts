// CLI for web deletion requests (spec 005 FR-016): `npm run delete-user -- person@example.com`.
// Removes the account, its sessions, device links and login codes — the same transaction as in-app deletion.
import { db, initDb, sql } from './db/client.js';
import { createPgStore } from './auth/pgStore.js';
import { isPlausibleEmail, normalizeEmail } from './auth/email.js';

const email = normalizeEmail(process.argv[2] ?? '');
if (!isPlausibleEmail(email)) {
  // eslint-disable-next-line no-console
  console.error('usage: npm run delete-user -- person@example.com');
  process.exit(2);
}

await initDb();
const deleted = await createPgStore(db).deleteUserByEmail(email);
// eslint-disable-next-line no-console
console.log(deleted ? `deleted the account for ${email}` : `no account for ${email} (nothing to delete)`);
await sql.end({ timeout: 5 });
process.exit(0);
