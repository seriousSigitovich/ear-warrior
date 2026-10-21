# Implementation Plan: Optional Email Sign-In

**Branch**: `005-user-auth` (created 2026-10-21 from `master`) | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-user-auth/spec.md`

## Summary

Optional, passwordless sign-in for the Android closed beta: the learner types an email, receives a 6-digit
one-time code, types it, and is signed in. Signing in **never** gates a feature; the anonymous per-install
`device_id` of spec 001/002 keeps working untouched, and sync stays keyed by `device_id` (Q1 = B: no
progress restore on a new install).

**Technical approach** (details in [research.md](./research.md)):

- **Server** (`server/`, Fastify + Drizzle + Postgres on Vercel): a new `src/auth/` module with pure,
  injectable parts — code generation and hashing, rate-limit decisions, session tokens, a mailer — and one
  route file `src/routes/auth.ts` registered with injected dependencies (store, mailer, clock, random) so
  every rule is testable with `app.inject` and an in-memory store, no Postgres needed. Four tables added to
  the idempotent boot DDL: `users`, `login_codes`, `device_links`, `auth_sessions`. Because Vercel
  instances are stateless, **all rate limits are counted in Postgres**, not in memory.
- **Attribution** is resolved **at read time** by joining `device_links` to `attempt_log` (and later to the
  product-events table): the existing `/api/attempts` and `/api/sync` routes do not change. Pre-sign-in
  events of a device become attributable the moment the link exists; a sign-out closes the link, so later
  events are anonymous again.
- **App** (Expo): pure auth logic in `src/services/auth/` and `src/lib/email.ts` (jest-testable), a thin
  secure token store over `expo-secure-store` (the one new **native** module, so it must be in the first
  AAB), a `useAuth` hook, a `sign-in` screen, and an "Account" section in Settings (sign in / signed-in
  email / sign out / delete account). Sentry and product analytics subscribe to the auth state through a
  small `onAuthChange` listener (their wiring is separate work, tracked in `docs/beta-checklist.md`).
- **Web**: a static "Delete your account" page in `landing/` (Play requires a public deletion URL); the
  request is handled by the owner within 7 days using a server CLI script (`npm run delete-user`).

## Technical Context

**Language/Version**: TypeScript — server `~5.6` on Node 20 (ESM, `tsx` for dev/test); app `~5.3`, React Native 0.86, Expo SDK 57

**Primary Dependencies**: server — Fastify 5, Drizzle ORM 0.36, `postgres` 3.4, zod 3, **+ `nodemailer`** (already used in `landing/api`); app — expo-router, expo-sqlite, **+ `expo-secure-store`** (native; version via `npx expo install`)

**Storage**: Postgres (new tables `users`, `login_codes`, `device_links`, `auth_sessions`); on device the session token in the OS secure store, the "offer seen" flag and last-used email in the existing SQLite key-value table

**Testing**: server — `node:test` via `tsx --test` (`server/package.json` `test` script gains `src/auth/*.test.ts`); app — Jest (ts-jest, node env, pure logic only; no RNTL, no hooks/`.tsx`). Tests are written first (Constitution II)

**Target Platform**: Android (closed beta, Play), server on Vercel serverless (`ear-warrior-api.vercel.app`); iOS not in scope

**Project Type**: mobile app + web-service (existing `server/` backend)

**Performance Goals**: `POST /api/auth/verify` p95 < 500 ms server time (SC-004 needs < 2 s end-to-end); `POST /api/auth/request` p95 < 4 s (bounded by SMTP); code email delivered ≤ 60 s for 95% (SC-003); practice loop budgets of spec 001 unaffected (no sign-in call is on the loop's path)

**Constraints**: offline practice unaffected; no in-memory server state (stateless serverless); no plaintext codes or tokens stored or logged (FR-022); identical response whether or not an email has an account (FR-008); beta mail through an existing Gmail mailbox (about 14 recipients, far under its daily cap)

**Scale/Scope**: ~14 beta users, a few hundred requests in total; one new route file, ~6 small server modules, ~5 small app modules, 1 new screen, 1 landing page

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Code Quality | New dependencies defensible vs. simpler alternative; no dead code; match surrounding conventions (idempotent boot DDL, `registerX(app)` route files, DI for IO) | PASS — `nodemailer` is already the project's mail library; `expo-secure-store` is justified in Complexity Tracking; module layout copies `server/src/social/` and `src/services/*` |
| II. Test-First (NON-NEGOTIABLE) | Failing tests first; contract tests for every endpoint; deterministic suite; coverage not regressing | PASS — all rules live in injectable modules with `node:test`/Jest tests listed in Project Structure; route tests use an in-memory store, not Postgres |
| III. UX Consistency | Reuse shared components; actionable errors; destructive actions confirmed; a11y baseline | PASS — screens built from `Screen`/`Card`/`Button`/`Kicker`, copy table in `contracts/client-auth.md` makes every error actionable; delete and sign-out use confirmation; FR-020 ties to spec 004 baseline |
| IV. Performance | Declared budgets; measured before release | PASS — budgets declared above; measured in `quickstart.md` (server timings) |

No violations. Gate result: **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/005-user-auth/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions and alternatives
├── data-model.md        # Phase 1 — tables, states, attribution rule
├── quickstart.md        # Phase 1 — runnable validation
├── contracts/
│   ├── auth-api.md      # HTTP contract (server ↔ app)
│   └── client-auth.md   # App-side modules, states, copy
├── checklists/
│   └── requirements.md  # Spec quality checklist (done)
└── tasks.md             # Phase 2 — /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
server/
├── src/
│   ├── auth/
│   │   ├── policy.ts          # constants: code TTL 10 min, 5 attempts, 5/h per email, 20/h per source, 60 s resend
│   │   ├── codes.ts           # generate 6 digits, HMAC hash, constant-time compare
│   │   ├── limits.ts          # pure decisions from counts + clock → allow / retry_after
│   │   ├── tokens.ts          # session token generate / sha256 hash / bearer parse
│   │   ├── email.ts           # normalize + validate (mirrors src/lib/email.ts on the app)
│   │   ├── mailer.ts          # Mailer interface + nodemailer implementation + console/null mailers
│   │   ├── store.ts           # AuthStore interface + Drizzle (Postgres) implementation
│   │   ├── memoryStore.ts     # in-memory AuthStore used by route tests
│   │   └── *.test.ts          # codes, limits, tokens, email, memoryStore parity
│   ├── routes/
│   │   ├── auth.ts            # registerAuth(app, deps): request, verify, me, signout, account delete
│   │   └── auth.test.ts       # inject-based contract + abuse tests
│   ├── db/{schema.ts,ddl.ts}  # + four tables (idempotent DDL, same style as existing)
│   ├── app.ts                 # register auth routes; add DELETE to CORS methods
│   └── scripts/delete-user.ts # owner CLI for web deletion requests (npm run delete-user -- <email>)
src/                            # Expo app
├── lib/email.ts                # normalizeEmail / isPlausibleEmail (pure)
├── services/auth/
│   ├── client.ts               # AuthClient over fetch (null when no EXPO_PUBLIC_API_URL)
│   ├── flow.ts                 # pure sign-in state machine (email → code → signed in), cooldown timer math
│   ├── session.ts              # SessionStore interface; secure-store adapter loaded lazily (like audio/session.ts)
│   └── messages.ts             # error code → actionable copy
├── features/auth/
│   └── useAuth.ts              # React hook: state, signIn/verify/signOut/delete, onAuthChange
app/
├── sign-in.tsx                 # email → code screen with Skip
└── settings.tsx                # + "Account" section
landing/
└── delete-account/index.html   # public deletion-request page; privacy page updated
tests/
├── unit/lib/email.test.ts
├── unit/auth/flow.test.ts
├── unit/auth/messages.test.ts
└── contract/authClient.test.ts # AuthClient against a mocked fetch
```

**Structure Decision**: extend the two existing projects in place — `server/` for the HTTP and data side,
the Expo `src/` + `app/` for the client — following their current conventions (route files registered from
`app.ts`, boot DDL in `db/ddl.ts`, DI + pure logic in `src/services/*`). No new package.

## Phase 1 re-check (post-design)

Design artifacts ([data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md))
add no new dependency beyond the two already justified and no layer beyond the injected `AuthStore`/`Mailer`
seams that the test-first rule requires. Principle III's error copy table and Principle IV's budgets are
concrete. Gate result remains **PASS**.

## Complexity Tracking

| Violation / deviation | Why Needed | Simpler Alternative Rejected Because |
|-----------------------|------------|--------------------------------------|
| New native module `expo-secure-store` | A session token is a credential; it must not sit in the plain SQLite file the sync pushes to the server | Reusing the SQLite key-value table would put the credential in a store that is copied by backups and read by the sync code path |
| `AuthStore` + `Mailer` interfaces on the server | Constitution II needs deterministic route tests without Postgres or SMTP | Calling Drizzle and nodemailer directly in routes (as `subscribe.ts` does) leaves rate limits, attempt limits and expiry untestable — those are the security rules of this feature |
| Branch policy (T086: branch per feature) | Applied: `005-user-auth` was created from `master` when implementation started (2026-10-21) | — |
| Native dependency must ship in the **first** AAB | Adding a native module later needs a new store build and another Play review cycle for every tester | Shipping sign-in via OTA only is impossible for a native module |
