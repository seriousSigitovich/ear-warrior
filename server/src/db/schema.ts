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
  boolean,
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

/** Idempotent DDL applied at boot (see db/ddl.ts). Kept here next to the schema for reference. */
export const RAW_DDL = sql``;
