// Drizzle schema for the Ear Warrior backend.
//
// Two typed tables carry the same anonymous, insert-mostly telemetry Supabase used to hold:
//   - signups     : landing "Get notified" waitlist (one row per email, case-insensitive).
//   - attempt_log : anonymous aggregate practice telemetry (no audio, no PII).
//
// One document table carries the durable copy of the on-device game history so Postgres is the
// source of truth while local SQLite stays an offline cache:
//   - sync_documents : sessions / attempts / melodies / difficulty_settings stored as JSON docs,
//                      keyed by (device_id, collection, doc_id). Lossless mirror of the RowStore.

import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/** Landing waitlist signups (was Supabase migration 0002_signups). */
export const signups = pgTable('signups', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  source: text('source'),
  userAgent: text('user_agent'),
});

/** Anonymous aggregate practice telemetry (was Supabase migration 0001_attempt_log). */
export const attemptLog = pgTable('attempt_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: text('device_id').notNull(),
  appVersion: text('app_version').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  difficultyId: text('difficulty_id').notNull(),
  difficultyRank: integer('difficulty_rank').notNull(),
  noteCount: integer('note_count').notNull(),
  verdict: text('verdict').notNull(),
  matchedCount: integer('matched_count').notNull(),
  wrongCount: integer('wrong_count').notNull(),
  missedCount: integer('missed_count').notNull(),
  extraCount: integer('extra_count').notNull(),
  confidence: real('confidence').notNull(),
  octaveMismatch: boolean('octave_mismatch').notNull().default(false),
  inputMode: text('input_mode').notNull().default('mic'),
});

/** Closed-beta product events: anonymous, one row per event (see routes/events.ts). */
export const appEvents = pgTable('app_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: text('device_id').notNull(),
  appVersion: text('app_version').notNull(),
  name: text('name').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  props: jsonb('props').notNull().default({}),
});

/**
 * Durable copy of on-device documents. `collection` is one of sessions | attempts | melodies |
 * difficulty_settings | key_value; `data` is the JSON row exactly as the client's RowStore holds it.
 * Last-write-wins on `updated_at` (see routes/sync.ts).
 */
export const syncDocuments = pgTable(
  'sync_documents',
  {
    deviceId: text('device_id').notNull(),
    collection: text('collection').notNull(),
    docId: text('doc_id').notNull(),
    data: jsonb('data').notNull(),
    updatedAt: doublePrecision('updated_at').notNull(),
    serverReceivedAt: timestamp('server_received_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.deviceId, t.collection, t.docId] }),
  }),
);

/** One row per published post (YouTube video / Instagram reel). */
export const socialPosts = pgTable(
  'social_posts',
  {
    platform: text('platform').notNull(),
    externalId: text('external_id').notNull(),
    title: text('title').notNull().default(''),
    url: text('url').notNull().default(''),
    kind: text('kind').notNull().default('video'),
    durationS: integer('duration_s'),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    videoNo: integer('video_no'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.platform, t.externalId] }) }),
);

/** Cumulative metrics of a post as of one UTC day. NULL = not reported by the platform. */
export const socialSnapshots = pgTable(
  'social_snapshots',
  {
    platform: text('platform').notNull(),
    externalId: text('external_id').notNull(),
    day: date('day', { mode: 'string' }).notNull(),
    views: integer('views'),
    likes: integer('likes'),
    comments: integer('comments'),
    shares: integer('shares'),
    saves: integer('saves'),
    reach: integer('reach'),
    avgWatchS: real('avg_watch_s'),
    avgWatchPct: real('avg_watch_pct'),
    follows: integer('follows'),
    profileVisits: integer('profile_visits'),
    collectedAt: timestamp('collected_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.platform, t.externalId, t.day] }) }),
);

/** Channel / account level numbers per UTC day (followers + platform-specific extras). */
export const socialAccountSnapshots = pgTable(
  'social_account_snapshots',
  {
    platform: text('platform').notNull(),
    day: date('day', { mode: 'string' }).notNull(),
    followers: integer('followers'),
    extra: jsonb('extra').$type<Record<string, number>>().notNull().default({}),
    collectedAt: timestamp('collected_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.platform, t.day] }) }),
);

/** Rotating credentials (Instagram long-lived token). */
export const socialTokens = pgTable('social_tokens', {
  platform: text('platform').primaryKey(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Collector run log. */
export const socialRuns = pgTable('social_runs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  platform: text('platform').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  ok: boolean('ok'),
  posts: integer('posts'),
  error: text('error'),
});

/** Optional email sign-in (spec 005). An account is a verified email; created on first correct code. */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** One-time sign-in codes (HMAC-hashed). Also the request log for the rate limits. */
export const loginCodes = pgTable('login_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  codeHash: text('code_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  usedAt: timestamp('used_at', { withTimezone: true }),
  supersededAt: timestamp('superseded_at', { withTimezone: true }),
  sourceHash: text('source_hash').notNull(),
});

/** Signed-in sessions; only sha256(token) is stored. */
export const authSessions = pgTable('auth_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  deviceId: text('device_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

/** Which account an install belonged to, and when (open link = unlinked_at null). */
export const deviceLinks = pgTable('device_links', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  deviceId: text('device_id').notNull(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
  unlinkedAt: timestamp('unlinked_at', { withTimezone: true }),
});

/** Idempotent DDL applied at boot (see db/ddl.ts). Kept here next to the schema for reference. */
export const RAW_DDL = sql``;

/** A signed-in learner's finished attempts (one row each; the account's progress). */
export const progressAttempts = pgTable(
  'progress_attempts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    sessionId: text('session_id').notNull(),
    melodyId: text('melody_id').notNull(),
    tuneId: text('tune_id').notNull(),
    verdict: text('verdict').notNull(),
    confidence: real('confidence').notNull(),
    lowConfidence: boolean('low_confidence').notNull(),
    timedOut: boolean('timed_out').notNull(),
    inputMode: text('input_mode').notNull(),
    noteResults: jsonb('note_results').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.id] }) }),
);

/** A signed-in learner's difficulty state: one row per account. */
export const progressDifficulty = pgTable('progress_difficulty', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  mode: text('mode').notNull(),
  adaptiveRank: integer('adaptive_rank').notNull(),
  fixedRank: integer('fixed_rank').notNull(),
  streakKind: text('streak_kind').notNull(),
  streakCount: integer('streak_count').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});
