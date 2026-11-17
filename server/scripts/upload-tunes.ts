// Seeds the tunes table from the app's library and uploads the voiced clips (spec 024).
//
//   npx tsx --env-file=.env scripts/upload-tunes.ts --dry-run   what would happen: tunes, clips, sizes, hashes
//   npx tsx --env-file=.env scripts/upload-tunes.ts             seed, upload every clip, show the tunes
//   npx tsx --env-file=.env scripts/upload-tunes.ts --only=mary,london
//
// Needs DATABASE_URL and BLOB_READ_WRITE_TOKEN. Idempotent: a clip whose hash is already recorded is skipped.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, sql } from '../src/db/client.js';
import { applyDdl } from '../src/db/ddl.js';
import { blobTuneUploader } from '../src/routes/adminTunes.js';
import { createPgTuneStore } from '../src/tunes/pgStore.js';
import { TUNES } from '../src/tunes/library.data.js';
import { seedTunes } from '../src/tunes/seed.js';

const here = dirname(fileURLToPath(import.meta.url));
const CLIPS = join(here, '../../assets/app/audio/melodies');
const dry = process.argv.includes('--dry-run');
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');

const store = createPgTuneStore(db);
const now = new Date();
if (!dry) {
  await applyDdl(sql);
  console.log('seeded', await seedTunes(store, now));
}

let uploaded = 0;
let skipped = 0;
let totalBytes = 0;
for (const t of TUNES) {
  if (only && !only.includes(t.id)) continue;
  const bytes = await readFile(join(CLIPS, `${t.id}.m4a`));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  totalBytes += bytes.length;
  const have = dry ? null : await store.get(t.id);
  if (have?.audioSha256 === sha256) {
    skipped++;
    if (have.hidden) await store.setHidden(t.id, false, now);
    continue;
  }
  if (dry) {
    console.log(`${t.id.padEnd(16)} L${t.rank} ${String(bytes.length).padStart(8)} B  ${sha256.slice(0, 12)}`);
    continue;
  }
  const url = await blobTuneUploader(t.id, bytes, sha256);
  await store.setAudio(t.id, { url, sha256, bytes: bytes.length }, now);
  await store.setHidden(t.id, false, now);
  uploaded++;
  console.log(`uploaded ${t.id} ${url}`);
}
console.log(dry ? `dry run: ${TUNES.length} tunes, ${(totalBytes / 1e6).toFixed(1)} MB of clips` : `uploaded ${uploaded}, unchanged ${skipped}`);
await sql.end({ timeout: 2 });
