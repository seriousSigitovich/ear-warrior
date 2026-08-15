# Contract: Attempt Log (anonymous, insert-only telemetry)

**Module**: `src/services/logging/` (outbox → `fetch` `POST /api/attempts`)
**External system**: the Ear Warrior **Node/Postgres backend** (`server/`, Fastify + Drizzle). **Scope**:
telemetry only — no accounts, no PII, no audio.

> **History**: this boundary originally targeted Supabase (anon key + insert-only RLS). It was migrated
> to the self-hosted Node/Postgres server; the payload and all privacy guarantees are unchanged, only the
> transport moved from `@supabase/supabase-js` to a plain HTTPS `POST`.

The app logs anonymized attempt records best-effort. Local SQLite remains the offline cache and the
practice loop's authoritative store (R8/R9); logging never blocks the loop and is queued in an offline
outbox when the backend is unreachable.

## Endpoint

```
POST {EXPO_PUBLIC_API_URL}/api/attempts
Content-Type: application/json
→ 200 { "ok": true }              on success
→ 400 { "ok": false, "error": "invalid_payload" }   zod validation failed
→ 502 { "ok": false, "error": "store_failed" }      Postgres insert failed
```

The server (`server/src/routes/telemetry.ts`) validates the body with zod and inserts one row into the
Postgres `attempt_log` table (`server/src/db/schema.ts`). There is **no read/update/delete endpoint** for
this data — it is insert-only *by API design* (the old anon-key + RLS mechanism is gone). Rows are read
only server-side (dashboard / service role).

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

## Postgres table (`attempt_log`)

Defined in `server/src/db/schema.ts` (Drizzle) and bootstrapped by `server/src/db/ddl.ts`:

```sql
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
create index if not exists attempt_log_device_idx on attempt_log (device_id, created_at);
```

## Behavioral contract

- Insert-only: the client only ever `POST`s this payload and MUST NOT attempt reads/updates/deletes;
  the backend exposes no such route.
- Payload MUST NOT contain audio, raw frames, note-by-note pitches, timestamps of play, location, or any
  PII — only the aggregate fields above (privacy note, R9). This bound is the spec-level requirement
  **FR-019** and is verified by **SC-008** (captured audio never leaves the device).
- Logging is **best-effort**: on failure/offline, records queue in the local outbox and flush later;
  loss of a log MUST NOT affect the learner-facing experience or local progress.
- `device_id` is generated once per install and stored locally; it is not tied to any identity.
- When `EXPO_PUBLIC_API_URL` is unset, the client is a no-op (`createNullAttemptLogClient`) and nothing
  is sent — the app stays fully offline.

## Test intent (required)

The outbox queue/flush/retry logic is unit-tested against a **mocked `AttemptLogClient`**: best-effort
insert, queue on failure, flush on reconnect, and — critically — logging never blocks or fails the
practice loop. Payload shape (anonymized aggregate fields only) is asserted in
`tests/contract/logging.test.ts`. Live insert-only behavior against the real backend is verified on-device
during the spike (quickstart Telemetry & offline scenarios).
