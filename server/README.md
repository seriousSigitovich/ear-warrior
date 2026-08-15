# Ear Warrior backend

Fastify + Drizzle + Postgres. Replaces the previous Supabase setup (telemetry, waitlist) and
becomes the durable source of truth for game history synced from the app. The mobile app keeps a
local SQLite cache so practice still works fully offline; the cache syncs to this service.

## Endpoints

| Method | Path             | Purpose                                                        |
| ------ | ---------------- | ------------------------------------------------------------- |
| GET    | `/health`        | Liveness probe.                                               |
| POST   | `/api/subscribe` | Landing waitlist signup `{ email }`. Dedup by lower(email).   |
| POST   | `/api/attempts`  | Anonymous aggregate practice telemetry (was `attempt_log`).   |
| POST   | `/api/sync`      | Push local documents (last-write-wins on `updated_at`).       |
| GET    | `/api/sync`      | Pull documents changed since `?since=<ms>` for a `device_id`. |

Data model: `signups` and `attempt_log` are typed tables. Game history (sessions, attempts,
melodies, difficulty_settings, key_value) is stored losslessly as JSON documents in
`sync_documents`, keyed by `(device_id, collection, doc_id)`.

## Run locally

```bash
cp .env.example .env
docker compose up postgres      # start Postgres on :5432
npm install
npm run dev                     # Fastify on :8080, applies schema on boot
```

Or run the whole stack in Docker:

```bash
docker compose up --build       # Postgres + API
```

## Migrations

The server applies idempotent DDL at boot (`src/db/ddl.ts`), so no migration step is needed for
development. For tracked production migrations generated from the Drizzle schema:

```bash
npm run db:generate             # writes SQL into ./drizzle
```

## Client configuration

Point the app at this server with `EXPO_PUBLIC_API_URL` (see `app.config.ts` in the repo root),
e.g. `EXPO_PUBLIC_API_URL=http://localhost:8080`.
