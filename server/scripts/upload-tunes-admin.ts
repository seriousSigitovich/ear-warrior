// Seeds and uploads the tunes through a running server's admin API (spec 024) — for when the database and the Blob
// token are not at hand, only the admin login. Same result as upload-tunes.ts: every tune created (hidden), its clip
// uploaded and the tune shown. Safe to run again: a tune whose clip is already there (same hash) is skipped.
//
//   ADMIN_URL=https://ear-warrior-api.vercel.app npx tsx --env-file=.env scripts/upload-tunes-admin.ts [--only=mary,london]
//
// Needs ADMIN_PASSWORD (and ADMIN_USER, default "admin") in the environment.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TUNES } from '../src/tunes/library.data.js';

const base = (process.env.ADMIN_URL ?? '').replace(/\/$/, '');
const password = process.env.ADMIN_PASSWORD;
if (!base || !password) throw new Error('ADMIN_URL and ADMIN_PASSWORD are required');
const auth = `Basic ${Buffer.from(`${process.env.ADMIN_USER ?? 'admin'}:${password}`).toString('base64')}`;
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const CLIPS = join(dirname(fileURLToPath(import.meta.url)), '../../assets/app/audio/melodies');

async function call(method: string, path: string, body?: BodyInit, type?: string): Promise<{ status: number; json: any }> {
  const res = await fetch(`${base}${path}`, { method, body, headers: { authorization: auth, ...(type ? { 'content-type': type } : {}) } });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const have = await call('GET', '/admin/tunes.json');
if (have.status !== 200) throw new Error(`admin login refused or server unreachable (${have.status})`);
const hashes = new Map<string, string | null>((have.json.tunes as { id: string; audio_sha256: string | null; hidden: boolean }[]).map((t) => [t.id, t.hidden ? null : t.audio_sha256]));

let done = 0;
let skipped = 0;
for (const t of TUNES) {
  if (only && !only.includes(t.id)) continue;
  const clip = await readFile(join(CLIPS, `${t.id}.m4a`));
  const sha = createHash('sha256').update(clip).digest('hex');
  if (hashes.get(t.id) === sha) {
    skipped++;
    continue;
  }
  const saved = await call(
    'POST',
    `/admin/tunes/${t.id}`,
    JSON.stringify({ title: t.title, level: t.rank, tempo_bpm: t.tempoBpm, phrases: [...t.phrases], notes: t.notes, scale: t.scale, source: t.source }),
    'application/json',
  );
  if (saved.status !== 200) throw new Error(`${t.id}: ${saved.status} ${JSON.stringify(saved.json)}`);
  const up = await call('PUT', `/admin/tunes/${t.id}/audio?show=1`, new Uint8Array(clip), 'audio/mp4');
  if (up.status !== 200) throw new Error(`${t.id} audio: ${up.status} ${JSON.stringify(up.json)}`);
  done++;
  console.log(`${String(done + skipped).padStart(3)} ${t.id}`);
}
console.log(`uploaded ${done}, unchanged ${skipped}`);
