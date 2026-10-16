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
    -- Added with fretboard input; existing rows were all microphone attempts.
    alter table attempt_log add column if not exists input_mode text not null default 'mic';
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

    -- Social analytics (YouTube / Instagram): one row per published post, one snapshot per post
    -- per UTC day. Cumulative counters are stored as-is; "growth" is a difference of snapshots.
    -- NULL means "the platform does not report this", which is different from 0.
    create table if not exists social_posts (
      platform      text        not null,
      external_id   text        not null,
      title         text        not null default '',
      url           text        not null default '',
      kind          text        not null default 'video',
      duration_s    int,
      published_at  timestamptz not null,
      video_no      int,
      first_seen_at timestamptz not null default now(),
      primary key (platform, external_id)
    );
    create table if not exists social_snapshots (
      platform        text not null,
      external_id     text not null,
      day             date not null,
      views           int,
      likes           int,
      comments        int,
      shares          int,
      saves           int,
      reach           int,
      avg_watch_s     real,
      avg_watch_pct   real,
      follows         int,
      profile_visits  int,
      collected_at    timestamptz not null default now(),
      primary key (platform, external_id, day),
      foreign key (platform, external_id) references social_posts (platform, external_id)
        on delete cascade
    );
    create table if not exists social_account_snapshots (
      platform     text not null,
      day          date not null,
      followers    int,
      extra        jsonb not null default '{}',
      collected_at timestamptz not null default now(),
      primary key (platform, day)
    );
    -- Credentials that rotate (Instagram long-lived tokens expire after 60 days and are refreshed).
    create table if not exists social_tokens (
      platform   text primary key,
      value      text not null,
      expires_at timestamptz,
      updated_at timestamptz not null default now()
    );
    -- One row per collector run, so the page can say "stale / failed" instead of showing old numbers.
    create table if not exists social_runs (
      id          bigserial primary key,
      platform    text not null,
      started_at  timestamptz not null default now(),
      finished_at timestamptz,
      ok          boolean,
      posts       int,
      error       text
    );
    create index if not exists social_runs_platform_idx on social_runs (platform, started_at desc);
  `);
}
