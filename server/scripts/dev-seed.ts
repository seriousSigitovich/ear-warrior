// Seeds a LOCAL database for testing the app against a local server (spec 024): all 100 tunes, visible, with the hash
// and size of their real clips but a placeholder download url (nothing is uploaded). The app plays levels 1-2 from
// what ships inside it, so those work as they will in production; clips of levels 3+ cannot be downloaded from here.
//
//   npx tsx --env-file=.env scripts/dev-seed.ts
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, sql } from '../src/db/client.js';
import { applyDdl } from '../src/db/ddl.js';
import { TUNES } from '../src/tunes/library.data.js';
import { createPgTuneStore } from '../src/tunes/pgStore.js';
import { seedTunes } from '../src/tunes/seed.js';

if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? 'postgres://localhost')) {
  throw new Error('dev-seed only runs against a local database');
}
const CLIPS = join(dirname(fileURLToPath(import.meta.url)), '../../assets/app/audio/melodies');
const store = createPgTuneStore(db);
const now = new Date();
await applyDdl(sql);
await seedTunes(store, now);
for (const t of TUNES) {
  const bytes = await readFile(join(CLIPS, `${t.id}.m4a`));
  await store.setAudio(t.id, { url: `https://example.invalid/tunes/${t.id}.m4a`, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length }, now);
  await store.setHidden(t.id, false, now);
}
console.log(`${TUNES.length} tunes visible`);
await sql.end({ timeout: 2 });
