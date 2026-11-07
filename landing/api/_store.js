// Signup store for the founding-members counter: an Upstash Redis sorted set (member = email,
// score = signup time), so dedup, position and total all come from one structure.
// Config (Vercel Marketplace -> Upstash Redis injects these on its own):
//   KV_REST_API_URL, KV_REST_API_TOKEN   (or UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN)
// Optional: SIGNUPS_BASE  signups collected before the store existed (they sit in the inbox).
// No store configured -> everything here returns null and the landing hides the counter.

const CAP = 100;
const KEY = 'signups';
const SOURCES_KEY = 'signup_sources';

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

/**
 * Registers an email (idempotent). Returns { count, position, isNew } or null when no store is configured.
 * `source` (e.g. "youtube:ear16") is kept in a hash next to the set; HSETNX keeps the FIRST touch, so a
 * repeat submit from another platform doesn't overwrite where the person originally came from.
 * Read it back with: HGETALL signup_sources
 */
async function addSignup(email, source) {
  if (!configured()) return null;
  const [added, rank, n] = await pipeline([
    ['ZADD', KEY, 'NX', Date.now(), email],
    ['ZRANK', KEY, email],
    ['ZCARD', KEY],
    ['HSETNX', SOURCES_KEY, email, source || 'landing'],
  ]);
  // ZADD NX returns 1 only when the email was not in the set yet.
  return { count: n + base(), position: rank + 1 + base(), isNew: added === 1 };
}

const PHONES_KEY = 'signup_phones';

/**
 * Saves the phone a signup answered ("android" | "iphone"). Returns false when the email never
 * signed up (so the endpoint can't be used to mail the owner arbitrary addresses), null when no
 * store is configured. Read it back with: HGETALL signup_phones
 */
async function setPhone(email, phone) {
  if (!configured()) return null;
  const [score] = await pipeline([['ZSCORE', KEY, email]]);
  if (score === null) return false;
  await pipeline([['HSET', PHONES_KEY, email, phone]]);
  return true;
}

const RESERVE_KEY = 'course_reservations';
const RESERVE_SOURCES_KEY = 'course_reservation_sources';

/**
 * Holds the founding price of the course for an email (idempotent; no payment is taken).
 * Returns { count, isNew } or null when no store is configured.
 * Read them back with: ZRANGE course_reservations 0 -1 WITHSCORES  /  HGETALL course_reservation_sources
 */
async function addReservation(email, source) {
  if (!configured()) return null;
  const [added, n] = await pipeline([
    ['ZADD', RESERVE_KEY, 'NX', Date.now(), email],
    ['ZCARD', RESERVE_KEY],
    ['HSETNX', RESERVE_SOURCES_KEY, email, source || 'course'],
  ]);
  return { count: n, isNew: added === 1 };
}

module.exports = { CAP, configured, getCount, addSignup, setPhone, addReservation };
