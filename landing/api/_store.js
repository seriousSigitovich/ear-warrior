// Signup store for the founding-members counter: an Upstash Redis sorted set (member = email,
// score = signup time), so dedup, position and total all come from one structure.
// Config (Vercel Marketplace -> Upstash Redis injects these on its own):
//   KV_REST_API_URL, KV_REST_API_TOKEN   (or UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN)
// Optional: SIGNUPS_BASE  signups collected before the store existed (they sit in the inbox).
// No store configured -> everything here returns null and the landing hides the counter.

const CAP = 100;
const KEY = 'signups';

const url = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const base = () => Math.max(0, parseInt(process.env.SIGNUPS_BASE || '0', 10) || 0);

const configured = () => Boolean(url() && token());

async function pipeline(commands) {
  const r = await fetch(`${url().replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error(`upstash ${r.status}`);
  const out = await r.json();
  const failed = out.find((x) => x.error);
  if (failed) throw new Error(`upstash: ${failed.error}`);
  return out.map((x) => x.result);
}

/** Current total, or null when no store is configured. */
async function getCount() {
  if (!configured()) return null;
  const [n] = await pipeline([['ZCARD', KEY]]);
  return n + base();
}

/** Registers an email (idempotent). Returns { count, position } or null when no store is configured. */
async function addSignup(email) {
  if (!configured()) return null;
  const [, rank, n] = await pipeline([
    ['ZADD', KEY, 'NX', Date.now(), email],
    ['ZRANK', KEY, email],
    ['ZCARD', KEY],
  ]);
  return { count: n + base(), position: rank + 1 + base() };
}

module.exports = { CAP, configured, getCount, addSignup };
