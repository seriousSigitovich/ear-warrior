# Research: Optional Email Sign-In

All decisions below close the Technical Context unknowns of [plan.md](./plan.md). Spec Q1 is already closed
(option B: no progress restore on a new install). Each entry: **Decision**, **Rationale**, **Alternatives**.

## R1 — Sign-in mechanism

**Decision**: email one-time code, 6 digits, typed into the app. No passwords, no links.

**Rationale**: nothing to hash, reset or leak; the user already has the email app open on the phone; no
deep-link setup (a link would need an Android intent filter, app-link verification and a way to carry the
token back — more native config than a typed code). 10^6 combinations are safe **because** each code allows
5 attempts and lives 10 minutes (FR-005/006): an attacker's chance per code is 5 / 10^6.

**Alternatives**: password + reset flow (more server code, more to defend, nothing gained for 14 testers);
magic link (deep links, harder on Android and in-app browsers); self-declared email without verification
(rejected by the owner on 2026-10-19 — "real authorization").

## R2 — Code storage and comparison

**Decision**: store `HMAC-SHA256(code, AUTH_PEPPER)` (hex), never the code. Compare with
`crypto.timingSafeEqual`. Generate with `crypto.randomInt(0, 1_000_000)` zero-padded to 6 digits.

**Rationale**: a database leak does not reveal live codes; HMAC with a server-only pepper keeps a
10^6-space hash from being brute-forced offline from the table alone. `randomInt` is a CSPRNG (not
`Math.random`). `AUTH_PEPPER` is a required env var; the server refuses to start auth routes without it.

**Alternatives**: plain-text codes (leak = takeover for ≤ 10 minutes); bcrypt/argon2 (pointless for a
10-minute 6-digit secret protected by an attempt counter, and slow on serverless).

## R3 — Session token

**Decision**: 32 random bytes, base64url, sent as `Authorization: Bearer <token>`. Server stores only
`sha256(token)` in `auth_sessions`. No expiry (spec Assumptions); revoked by sign-out, account deletion or
`delete-user`. One session row per sign-in, bound to the `device_id` that verified.

**Rationale**: opaque tokens need no signing key rotation and are revocable instantly (deletion on one phone
signs the other out at its next `GET /api/auth/me`). The token has 256 bits of entropy, so a fast hash is
enough to protect it at rest.

**Alternatives**: JWT (cannot revoke without a lookup anyway; adds key management); cookies (not a browser).

## R4 — Where rate limits are counted

**Decision**: in Postgres, by querying `login_codes`: requests for the email in the last hour (≤ 5), requests
from the same source (hashed IP) in the last hour (≤ 20), and the newest request's age (≥ 60 s). Pure
`limits.ts` turns those counts + the clock into `allow` or `retry_after_s`.

**Rationale**: the API runs as stateless Vercel functions — an in-memory counter would reset per instance and
per cold start, which defeats the limit. `login_codes` already records every request, so no extra table.
IP is hashed with the pepper before storage (privacy; the raw address is never kept).

**Alternatives**: in-memory map (ineffective on serverless); Redis/Upstash (a new service for 14 users; the
landing already uses Upstash, but a second dependency in `server/` is not justified); platform firewall rules
(Vercel WAF rate limiting can be added later, as defence in depth, without changing this design).

## R5 — Enumeration safety

**Decision**: `POST /api/auth/request` never reads `users`. It always creates a code, sends a mail and
returns the same body for every address; the account is created only inside `verify`. Rate-limit responses
depend only on request counts for that address/source.

**Rationale**: FR-008 holds by construction — there is no branch on "account exists". Timing is the same
path for every address.

**Alternatives**: separate sign-up and sign-in (needs an "exists" answer — rejected).

## R6 — How events become attributable (FR-011/012)

**Decision**: **read-time attribution** through `device_links (device_id, user_id, linked_at, unlinked_at)`.
`/api/attempts`, `/api/sync` and the app's event payloads do **not** change. The attribution rule is in
[data-model.md](./data-model.md#attribution-rule).

**Rationale**: (1) it satisfies "events before sign-in become attributable" without rewriting rows; (2) events
queued offline in the outbox and flushed after sign-in are attributed correctly; (3) sign-out just closes the
link, deletion just removes the links — the attribution disappears with them (FR-015); (4) no PII is added to
`attempt_log` (SC-008 of spec 001 stays honest: the table still holds only the anonymous device id).

**Alternatives**: write `user_id` onto each event at insert time (needs the bearer token on every event call,
breaks for queued events, and cannot back-attribute without an UPDATE); store email in events (PII in the
high-volume table).

## R7 — Crash reports and product events

**Decision**: this feature exposes a tiny `onAuthChange(listener)` on the client auth hook/service. The Sentry
and product-events work (separate items in `docs/beta-checklist.md`) subscribe and call
`Sentry.setUser({ email })` / `Sentry.setUser(null)` and add `user_id` to their payloads. This spec does not
install Sentry.

**Rationale**: keeps the three pieces independently shippable; the contract between them is one function.

**Alternatives**: wire Sentry inside auth (couples two pieces; Sentry is native and must land first anyway).

## R8 — Sending the mail

**Decision**: `nodemailer` over SMTP with the existing Gmail mailbox for the beta (env: `SMTP_HOST` default
`smtp.gmail.com`, `SMTP_USER`, `SMTP_PASS` as an app password, `MAIL_FROM` default `SMTP_USER`). The send is
`await`ed **before** the HTTP response — a serverless function may be frozen the moment it replies. A failure
returns `mail_failed` (502) and the app offers "Send again". A `Mailer` interface has three implementations:
SMTP (default), a console mailer for local dev (`MAIL_DRIVER=console` prints the code; refused when
`VERCEL` is set), and a recording mailer for tests.

**Rationale**: zero new vendors, same pattern as `landing/api/subscribe.js`. For ~14 recipients the Gmail
sending cap is not a concern (verify the current limit before widening the beta). Gmail rewrites the
`From` to the authenticated account, so the message comes from the owner's address — acceptable for a closed
beta, and the reason the spec says a dedicated provider is chosen **before** public release.

**Alternatives**: Resend/Postmark now (better deliverability and a branded sender, but a new account, domain
DNS and one more processor to declare in Data Safety before the beta; cheap to swap later behind `Mailer`);
sending from the landing function (splits auth across two deployments).

## R9 — Reviewer test account

**Decision**: env pair `AUTH_TEST_EMAIL` + `AUTH_TEST_CODE` (a 6-digit string). The feature is enabled only if
**both** are set and the code is 6 digits; otherwise it does not exist. In `request`, that email sends no mail
(same response). In `verify`, that exact email + that exact code signs in; any other email with that code
fails normally. Comparison is constant-time. Disabling = unset the env vars and redeploy (no app release).

**Rationale**: FR-017/SC-009 exactly; the fixed code can never be a skeleton key because it is bound to one
email. Since sign-in is optional, the Play reviewer normally never needs it — this is insurance for the
"App access" form.

**Alternatives**: a permanent seeded user (cannot be switched off without a deploy that removes data);
accepting any code for a flag (unsafe).

## R10 — Token storage on the device

**Decision**: `expo-secure-store` (Android Keystore-backed). The `SessionStore` interface
(`get/set/clear`) is injected; the adapter is `require`d lazily so the pure-logic Jest runner never loads
native code (same trick as `src/services/audio/session.ts`). Device id, "offer seen" and last email stay in
the existing SQLite key-value table.

**Rationale**: a credential should not live next to synced documents. The module is native, so it goes into
the **first** AAB with Sentry.

**Alternatives**: SQLite key-value (no hardware-backed protection; sits in the file the app syncs);
AsyncStorage (not installed, same weakness).

## R11 — Account deletion (FR-014/015/016)

**Decision**: in the app, `DELETE /api/auth/account` (Bearer) removes the user, all their sessions, all their
device links and their login codes in one transaction, then the app clears local session state. For people
without the app, a static page `landing/delete-account/` explains the request (a `mailto:` to the owner with
the registered address) and states the 7-day completion time; the owner runs
`npm run delete-user -- <email>` in `server/`, which calls the same store function. The privacy page links
to it.

**Rationale**: Play requires an in-app path **and** a public URL for apps that create accounts. At 14 users a
manual web route is honest and cheap, and SC-008 allows 7 days. An unauthenticated self-serve web delete would
need its own email verification round trip — build it only if volume ever justifies it.

**Alternatives**: self-serve web deletion with an emailed code (extra endpoint, page and abuse surface now);
soft-delete (leaves the email behind, contradicts FR-015).

## R12 — Schema management

**Decision**: add the four tables to the idempotent boot DDL (`db/ddl.ts`) and mirror them in
`db/schema.ts` for typed Drizzle queries — the same approach as every existing table. No separate migration
files.

**Rationale**: matches the codebase; Vercel applies DDL lazily before the first non-`/health` request.

**Alternatives**: `drizzle-kit` migrations (the project does not use them for existing tables; mixing two
mechanisms would be the only inconsistency).

## R13 — Client sign-in flow as a pure state machine

**Decision**: `src/services/auth/flow.ts` holds the screen states (`email` → `code` → `done`), email
normalisation, the resend cooldown countdown, and attempts-left display as pure functions over an injected
clock — the `.tsx` screen only renders them. Error codes from the server map to plain-language copy in
`messages.ts` (Constitution III).

**Rationale**: the repo's Jest runner cannot test hooks or `.tsx`; keeping the logic pure is the project's
existing pattern ("logic lives in pure `.ts`").

## R14 — Session validity check on the device

**Decision**: on app start (and when returning from background after > 1 hour), if a token exists and the
network is up, call `GET /api/auth/me`; `401` clears the local session (account deleted elsewhere or token
revoked). Offline, the app stays signed in locally and never blocks.

**Rationale**: the spec edge case "deleted on one phone while signed in on another"; costs one tiny request.

## R15 — What stays unchanged

`/api/sync`, `/api/attempts`, the SQLite RowStore, the outbox and the practice loop are not touched.
Spec 001 FR-019/SC-008 and spec 002's "there are no accounts" receive a short amendment note pointing here
(a documentation task, not a code change).
