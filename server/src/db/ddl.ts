// Idempotent schema bootstrap. Runs on server start so a fresh Postgres (e.g. the docker-compose
// container) is ready without a separate migration step. Drizzle is still used for typed queries;
// this DDL simply guarantees the tables exist. For versioned migrations use `npm run db:generate`.

import type { Sql } from 'postgres';

export async function applyDdl(sql: Sql): Promise<void> {
  await sql.unsafe(`
    create extension if not exists "pgcrypto";

    -- Landing waitlist signups (was Supabase 0002).
    create table if not exists signups (
      id          uuid primary key default gen_random_uuid(),
      email       text not null check (position('@' in email) > 1 and char_length(email) <= 320),
      created_at  timestamptz not null default now(),
      source      text,
      user_agent  text
    );
    -- One signup per email, case-insensitive.
    create unique index if not exists signups_email_lower_idx on signups (lower(email));

    -- Anonymous aggregate practice telemetry (was Supabase 0001). No audio, no PII.
    create table if not exists attempt_log (
      id                uuid primary key default gen_random_uuid(),
      device_id         text not null,
      app_version       text not null,
      created_at        timestamptz not null default now(),
      difficulty_id     text not null,
      difficulty_rank   int  not null,
      note_count        int  not null,
      verdict           text not null check (verdict in ('correct','incorrect')),
      matched_count     int  not null,
      wrong_count       int  not null,
      missed_count      int  not null,
      extra_count       int  not null,
      confidence        real not null,
      octave_mismatch   boolean not null default false
    );
    create index if not exists attempt_log_device_idx on attempt_log (device_id, created_at);

    -- Durable mirror of the on-device document store (sessions/attempts/melodies/difficulty/kv).
    create table if not exists sync_documents (
      device_id          text             not null,
      collection         text             not null,
      doc_id             text             not null,
      data               jsonb            not null,
      updated_at         double precision not null,
      server_received_at timestamptz      not null default now(),
      primary key (device_id, collection, doc_id)
    );
    create index if not exists sync_documents_device_idx on sync_documents (device_id, collection);
  `);
}
