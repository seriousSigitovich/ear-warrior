-- Anonymous, insert-only attempt log (T047, contracts/supabase-attempt-log.md).
-- Telemetry only: no accounts, no PII, no audio. Local SQLite remains the source of truth.

create table if not exists attempt_log (
  id                uuid primary key default gen_random_uuid(),
  device_id         text not null,           -- random per-install id, no PII
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

-- Anonymous, insert-only access with the anon key.
alter table attempt_log enable row level security;

create policy "anon insert only" on attempt_log
  for insert to anon with check (true);
-- No select/update/delete policy → anon cannot read or modify existing rows.
