# Tasks: Optional Email Sign-In

Implemented 2026-10-21 on `master` (branch policy decision from plan.md still open; nothing committed). Tests were written first.
`[x]` = done and covered by an automated check; `[ ]` = needs a device, a deploy or the owner.

## Server (`server/`)

- [x] T100 Pure modules with tests: `auth/{email,codes,tokens,limits,policy}.ts` (+ `*.test.ts`)
- [x] T101 `AuthStore` interface, in-memory and Postgres implementations, one shared contract suite (`store.contract.ts`) run against both — Postgres run needs a local DB, skipped otherwise
- [x] T102 Tables `users`, `login_codes`, `auth_sessions`, `device_links` in boot DDL + Drizzle schema; view `attempt_log_attributed` (attribution rule)
- [x] T103 `Mailer` (SMTP via nodemailer, console for local dev, recording for tests)
- [x] T104 Routes `request`, `verify`, `me`, `signout`, `account` (`routes/auth.ts`) with 29 contract/abuse tests incl. test account and log-safety
- [x] T105 Wiring: `buildApp({ auth })`, CORS `DELETE`, `.env.example`
- [x] T106 Owner CLI `npm run delete-user -- <email>` (`src/delete-user.ts`)
- [x] T107a Deployed 2026-10-21 with `AUTH_PEPPER` set (`ear-warrior-api`); live endpoints answer
- [x] T107b `SMTP_USER`, `SMTP_PASS` set on `ear-warrior-api` and redeployed 2026-10-21 (via `server/scripts/copy-smtp.sh`). Real mail verified end to end on production: request → email arrived → verify → `me` → delete account
- [ ] T107c Optional `AUTH_TEST_EMAIL` + `AUTH_TEST_CODE` for the Play reviewer, only if the store asks
- [ ] T108 Measure `verify` p95 < 500 ms and mail delivery ≤ 60 s against the deployed server (quickstart §2)

## App (`src/`, `app/`)

- [x] T110 `lib/email.ts`; `services/auth/{client,messages,flow,session,service}.ts` with Jest tests (46)
- [x] T111 `features/auth/{authService,useAuth}.ts`; `expo-secure-store` added to dependencies
- [x] T112 `app/sign-in.tsx` (email → code, Skip, resend countdown, announced to screen readers)
- [x] T113 Settings → Account (sign in / email / sign out / delete, each destructive step confirmed)
- [x] T114 One-time sign-in offer from Home; Home button renamed "Settings"
- [x] T115a Native rebuild with `expo-secure-store`; on an Android emulator (against a local API): first-launch offer, email → code, wrong-code counter, resend limit copy, sign-in persists across app restart, sign out and delete both confirmed and verified in Postgres
- [x] T115b Emulator checks against the production API (2026-10-21): fresh first launch shows the offer; Skip → practice works in airplane mode; offline sign-in says "Can't reach the server … keep practising"; font scale 2.0 keeps the layout; every control has a label and a ≥ 44 dp target; real e-mail code → signed in → delete account
- [ ] T115c Still needs a physical phone: real TalkBack speech (labels were checked from the accessibility tree only) and the first Play-bound AAB
- [ ] T116 Subscribe Sentry / product events to `getAuthService().onAuthChange` when those land (R7)

## Web and docs

- [x] T120 `landing/delete-account/` public deletion page; privacy page and sitemap updated
- [x] T121a Deployed `landing/` 2026-10-21 (`earwarrior.app` re-pointed to the new deployment)
- [ ] T121b Fill in the Play Data Safety form (email, account id, sign-in method, deletion route)
- [x] T122 Amendment notes in specs 001 (FR-019) and 002 (no accounts); beta checklist updated

## Found on the device

- First launch on a fresh install: an `execAsync` NullPointerException in expo-sqlite, because several screens (and the new auth service) each opened their own connection to `ear-warrior.db` while the tables were still being created. `defaultRowStore()` is now one shared store (`src/services/storage/db.ts`); two fresh-database runs after the change were clean.

- Sign-out and account deletion failed against the real server: the client sent `Content-Type: application/json` with an empty body and Fastify answered 400. Server `inject` tests did not set the header, so they passed. Fixed in `src/services/auth/client.ts` (Content-Type only with a body) with a regression test in `tests/contract/authClient.test.ts`.
