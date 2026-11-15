# Data Model: Optional Google Sign-In

One new server table; no change to `users`, `auth_sessions`, `device_links` (identity is the email, R3/R8 in research.md).

## Server table

### `google_tickets` — one-time hand-over from the callback to the app

| Field | Type | Rules |
|-------|------|-------|
| `ticket_hash` | text, PK | `sha256(ticket)` hex; the ticket (32 random bytes, base64url) itself is never stored or logged |
| `email` | text, not null | normalised, verified by Google (`email_verified = true`) |
| `challenge` | text, not null | `base64url(sha256(verifier))` from the signed state (the verifier was made by `start`); exchange must present the matching verifier |
| `created_at` | timestamptz, default `now()` | |
| `expires_at` | timestamptz, not null | `created_at + 2 min` |
| `used_at` | timestamptz, null | set by the single attempt at `exchange`; a used ticket is never accepted again (R9) |

Rows older than 24 h are deleted opportunistically on each `callback`. Added to the idempotent boot DDL (`server/src/db/ddl.ts`) and mirrored in Drizzle `schema.ts`.

**Ticket states** (derived): `active` (not used, not expired) → `used` | `expired`.

## Stateless pieces (not stored)

- **Verifier**: made by `start`, returned once to the app, never stored on the server (only its hash, inside the state).
- **OAuth `state`**: `base64url(JSON{challenge, exp}) + "." + HMAC-SHA256(that, AUTH_PEPPER)`; lifetime 10 min.
- **Google identity assertion**: validated in memory in the callback and discarded; only the email survives, inside a ticket.

## Environment (server)

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (Web client of the sign-in project, R7). `AUTH_PEPPER` (existing) also signs the state. Optional `PUBLIC_API_URL` (default `https://ear-warrior-api.vercel.app`) builds the redirect URI. Without the first two, `/api/auth/google/*` answer `503 google_disabled` and `providers` reports `google: false`.

## On-device state

| Key (SQLite key-value) | Content | Lifetime |
|-------------------------|---------|----------|
| `ew.googlePending` | `{ verifier, startedAt }` as JSON | written before the browser opens; cleared on success, error, or after 10 min |

The session token keeps living in the secure store exactly as for the email code (`SessionStore`).
