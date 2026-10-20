# Data Model: Optional Email Sign-In

Server tables (Postgres, added to the idempotent boot DDL and mirrored in Drizzle `schema.ts`) and the
small amount of on-device state. Field names are snake_case in SQL. Entities map to the spec's Key Entities.

## Server tables

### `users` — Account

| Field | Type | Rules |
|-------|------|-------|
| `id` | uuid, PK, default `gen_random_uuid()` | |
| `email` | text, not null | stored **normalised** (trimmed, lower-cased); `char_length ≤ 320`; contains `@` after position 1 |
| `created_at` | timestamptz, default `now()` | |

Unique index on `lower(email)`. An account is created inside `verify` on first success (FR-009); never by
`request` (R5). Deleting a user cascades to `auth_sessions` and `device_links`.

### `login_codes` — Sign-in code

| Field | Type | Rules |
|-------|------|-------|
| `id` | uuid, PK | |
| `email` | text, not null | normalised; **not** a foreign key (the account may not exist yet) |
| `code_hash` | text, not null | `HMAC-SHA256(code, AUTH_PEPPER)` hex; empty string for the test account (no code row is created for it) |
| `created_at` | timestamptz, default `now()` | doubles as the request log for rate limits |
| `expires_at` | timestamptz, not null | `created_at + 10 min` |
| `attempts` | int, not null, default 0 | wrong entries so far; dead at 5 |
| `used_at` | timestamptz, null | set on success; a used code is never accepted again |
| `superseded_at` | timestamptz, null | set on all older active codes of the email when a newer one is issued |
| `source_hash` | text, not null | `HMAC-SHA256(client_ip, AUTH_PEPPER)` hex; the raw IP is never stored |

Indexes: `(email, created_at desc)` and `(source_hash, created_at desc)` for the limit queries. Rows older
than 24 h are deleted opportunistically on each `request`.

**Code states** (derived, not stored): `active` (not used, not superseded, not expired, attempts < 5) →
`used` | `superseded` | `expired` | `exhausted` (attempts = 5). Only the newest code of an email can be
`active`.

### `auth_sessions` — Signed-in session

| Field | Type | Rules |
|-------|------|-------|
| `token_hash` | text, PK | `sha256(token)` hex; the token itself is never stored |
| `user_id` | uuid, not null, FK → `users(id)` on delete cascade | |
| `device_id` | text, not null | the install that verified |
| `created_at` | timestamptz, default `now()` | |
| `revoked_at` | timestamptz, null | set by sign-out; a revoked session is refused |

Index on `user_id`. No expiry in the beta (spec Assumptions).

### `device_links` — Device link

| Field | Type | Rules |
|-------|------|-------|
| `id` | bigserial, PK | |
| `device_id` | text, not null | the anonymous per-install id (`dev_` + 32 hex) |
| `user_id` | uuid, not null, FK → `users(id)` on delete cascade | |
| `linked_at` | timestamptz, default `now()` | |
| `unlinked_at` | timestamptz, null | set by sign-out; open link = null |

Constraint: at most **one open link per device** (partial unique index on `device_id` where
`unlinked_at is null`). Signing in on a device that is still linked to another user closes that link first.
Index on `(user_id)`.

### Reviewer test account

Not a table: two environment variables, `AUTH_TEST_EMAIL` and `AUTH_TEST_CODE` (see R9). A successful test
sign-in creates an ordinary `users` row for that email.

## Attribution rule

The owner's views resolve "whose is this event?" with the function below (a SQL view/helper in `server/`,
used by the dashboard and by ad-hoc queries; **no change** to `attempt_log`, `sync_documents` or the events
routes):

For an event with `device_id = D` and time `t`:

1. Let the links of `D` ordered by `linked_at` be `L1, L2, …`.
2. If there are none → **anonymous**.
3. If `t < L1.linked_at` → `L1.user_id` (events before the first sign-in belong to whoever first signed in on
   that install — FR-011).
4. Otherwise the link `Lk` with `Lk.linked_at ≤ t` and (`Lk.unlinked_at` is null or `t < Lk.unlinked_at`)
   → `Lk.user_id`.
5. Otherwise (`t` falls in a gap after a sign-out) → **anonymous** (FR-012).

Deleting an account removes its links, so every event it owned becomes anonymous again (FR-015).

## Validation rules (shared by server and app)

- Email: trimmed and lower-cased before any use; must match `local@domain.tld`, ≤ 320 chars (zod `.email()`
  on the server, the same rule in `src/lib/email.ts` on the app so errors appear before a request is made).
- Code: exactly 6 digits `^[0-9]{6}$`.
- `device_id`: 1–80 chars (same limit as `/api/sync`).

## State transitions (account/device)

```text
anonymous --verify(ok)--> signed-in (link open, session row)
signed-in --signout-----> anonymous (session revoked, link closed)        [account kept]
signed-in --delete------> anonymous (user, sessions, links, codes removed)
signed-in(other phone) --GET /me after delete--> 401 --> local sign-out
```

## On-device state

| Key | Where | Content |
|-----|-------|---------|
| session token | OS secure store (`ew.session`) | opaque bearer token; absent = signed out |
| `ew.signInOfferSeen` | SQLite key-value | `"1"` once the first-launch offer was shown or skipped |
| `ew.lastEmail` | SQLite key-value | last email typed, to prefill the field; cleared on sign-out and deletion |
| `ew.deviceId` | SQLite key-value (existing) | unchanged |
