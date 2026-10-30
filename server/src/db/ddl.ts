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

    -- Closed-beta product events (app_open, onboarding_done, session_start, session_end). Anonymous like
    -- attempt_log: random per-install device id, no PII. occurred_at is the client clock (events can be
    -- flushed late); created_at is when the server got it.
    create table if not exists app_events (
      id           uuid primary key default gen_random_uuid(),
      device_id    text not null,
      app_version  text not null,
      name         text not null check (name in ('app_open','onboarding_done','session_start','session_end')),
      occurred_at  timestamptz not null,
      created_at   timestamptz not null default now(),
      props        jsonb not null default '{}'
    );
    create index if not exists app_events_device_idx on app_events (device_id, occurred_at);

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

    -- Optional email sign-in (spec 005). Attribution of events to an account is a read-time join through
    -- device_links, so attempt_log / sync_documents stay anonymous and are never rewritten.
    create table if not exists users (
      id          uuid primary key default gen_random_uuid(),
      email       text not null check (position('@' in email) > 1 and char_length(email) <= 320),
      created_at  timestamptz not null default now()
    );
    create unique index if not exists users_email_lower_idx on users (lower(email));

    -- Not a foreign key: the account may not exist yet. Doubles as the request log for the rate limits.
    create table if not exists login_codes (
      id             uuid primary key default gen_random_uuid(),
      email          text not null,
      code_hash      text not null,
      created_at     timestamptz not null default now(),
      expires_at     timestamptz not null,
      attempts       int not null default 0,
      used_at        timestamptz,
      superseded_at  timestamptz,
      source_hash    text not null
    );
    create index if not exists login_codes_email_idx on login_codes (email, created_at desc);
    create index if not exists login_codes_source_idx on login_codes (source_hash, created_at desc);

    create table if not exists auth_sessions (
      token_hash  text primary key,
      user_id     uuid not null references users (id) on delete cascade,
      device_id   text not null,
      created_at  timestamptz not null default now(),
      revoked_at  timestamptz
    );
    create index if not exists auth_sessions_user_idx on auth_sessions (user_id);

    create table if not exists device_links (
      id          bigserial primary key,
      device_id   text not null,
      user_id     uuid not null references users (id) on delete cascade,
      linked_at   timestamptz not null default now(),
      unlinked_at timestamptz
    );
    create index if not exists device_links_user_idx on device_links (user_id);
    -- At most one open link per install.
    create unique index if not exists device_links_open_idx on device_links (device_id) where unlinked_at is null;

    -- A signed-in learner's progress, one table per kind of fact; deleting the account deletes it.
    create table if not exists progress_attempts (
      user_id         uuid        not null references users (id) on delete cascade,
      id              text        not null,
      session_id      text        not null,
      melody_id       text        not null,
      tune_id         text        not null,
      verdict         text        not null check (verdict in ('correct','incorrect')),
      confidence      real        not null,
      low_confidence  boolean     not null,
      timed_out       boolean     not null,
      input_mode      text        not null,
      note_results    jsonb       not null,
      created_at      timestamptz not null,
      primary key (user_id, id)
    );
    create index if not exists progress_attempts_user_idx on progress_attempts (user_id, created_at desc);

    create table if not exists progress_difficulty (
      user_id        uuid        primary key references users (id) on delete cascade,
      mode           text        not null check (mode in ('adaptive','fixed')),
      adaptive_rank  int         not null,
      fixed_rank     int         not null,
      streak_kind    text        not null,
      streak_count   int         not null,
      updated_at     timestamptz not null
    );

    -- Owner's view: attempt_log with the account each row belongs to (data-model.md "Attribution rule").
    -- A row before a device's first link belongs to whoever linked first; otherwise to the link that was
    -- open at its time; a gap after sign-out is anonymous (user_id / email are null).
    create or replace view attempt_log_attributed as
    select a.id, a.device_id, a.created_at, a.difficulty_id, a.verdict, a.input_mode, u.id as user_id, u.email
    from attempt_log a
    left join lateral (
      select l.user_id
      from device_links l
      where l.device_id = a.device_id
        and (
          (l.linked_at <= a.created_at and (l.unlinked_at is null or a.created_at < l.unlinked_at))
          or (a.created_at < l.linked_at
              and not exists (select 1 from device_links p where p.device_id = l.device_id and p.linked_at < l.linked_at))
        )
      order by l.linked_at desc
      limit 1
    ) hit on true
    left join users u on u.id = hit.user_id;
  `);
}
