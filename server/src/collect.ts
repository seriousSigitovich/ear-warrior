// CLI: `npm run collect` (dev) / `node dist/collect.js` (prod, from cron). Exit code 1 if any
// configured platform failed, so a scheduler can alert on it.
import { initDb, sql } from './db/client.js';
import { runCollectors } from './social/collect.js';

await initDb();
const reports = await runCollectors();
for (const r of reports) {
  // eslint-disable-next-line no-console
  console.log(`${r.platform}: ${r.status}${r.posts !== undefined ? ` (${r.posts} posts)` : ''}${r.error ? ` — ${r.error}` : ''}`);
}
await sql.end({ timeout: 5 });
process.exit(reports.some((r) => r.status === 'failed') ? 1 : 0);
