# Contract: Supabase Attempt Log (anonymous, insert-only)

**Module**: `src/services/logging/` (outbox → `@supabase/supabase-js`)
**External system**: Supabase Postgres. **Scope**: telemetry only — no accounts, no PII, no audio.

The app logs anonymized attempt records best-effort. Local SQLite remains the source of truth (R8/R9);
logging never blocks the practice loop and is queued in an offline outbox when unreachable.

## Table

```sql
create table attempt_log (
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

-- Anonymous, insert-only access with the anon key:
alter table attempt_log enable row level security;
create policy "anon insert only" on attempt_log
  for insert to anon with check (true);
-- No select/update/delete policy → anon cannot read or modify existing rows.
```

## Insert payload (JSON)

```json
{
  "device_id": "b1f3…(random, generated locally, no PII)",
  "app_version": "0.1.0",
  "difficulty_id": "L2",
  "difficulty_rank": 2,
  "note_count": 4,
  "verdict": "incorrect",
  "matched_count": 3,
  "wrong_count": 1,
  "missed_count": 0,
  "extra_count": 0,
  "confidence": 0.82,
  "octave_mismatch": false
}
```

## Behavioral contract

- Insert-only; the client uses the **anon** key and MUST NOT attempt reads/updates/deletes.
- Payload MUST NOT contain audio, raw frames, note-by-note pitches, timestamps of play, location, or any
  PII — only the aggregate fields above (privacy note, R9). This bound is the spec-level requirement
  **FR-019** and is verified by **SC-008** (captured audio never leaves the device).
- Logging is **best-effort**: on failure/offline, records queue in the local outbox and flush later;
  loss of a log MUST NOT affect the learner-facing experience or local progress.
- `device_id` is generated once per install and stored locally; it is not tied to any identity.

## Test intent (required)

The outbox queue/flush/retry logic is unit-tested against a **mocked Supabase client**: best-effort
insert, queue on failure, flush on reconnect, and — critically — logging never blocks or fails the
practice loop. Payload shape is asserted in a contract test. Live RLS behavior (anon can insert, cannot
read/update/delete) is verified against the real project during the spike.
