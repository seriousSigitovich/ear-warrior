# Tasks: Optional Email Sign-In

Implemented 2026-10-21 on branch `005-user-auth`, merged into `master`. Tests were written first.
`[x]` = done and covered by an automated check; `[ ]` = needs a device, a deploy or the owner.
Tags: `[US…]` user story, `[FR/SC…]` requirement or success criterion from spec.md.

## Gate: first Play-bound AAB

Do not build or submit the first AAB until T108 (Constitution IV), T121b (FR-021) and T115c are closed.

## Server (`server/`)

- [x] T100 [US1 US3] [FR-004…008, 022] Pure modules with tests: `auth/{email,codes,tokens,limits,policy}.ts` (+ `*.test.ts`)
- [x] T101 [US1] [FR-005…007] `AuthStore` interface, in-memory and Postgres implementations, one shared contract suite (`store.contract.ts`) run against both — Postgres run needs a local DB, skipped otherwise
- [x] T102 [US3 US4 US5] [FR-011, 012, 015] Tables `users`, `login_codes`, `auth_sessions`, `device_links` in boot DDL + Drizzle schema; view `attempt_log_attributed` (attribution rule)
- [x] T103 [US1] [FR-001, SC-003] `Mailer` (SMTP via nodemailer, console for local dev, recording for tests)
- [x] T104 [US1 US4 US5 US6] [FR-004…009, 013, 014, 017, 022] Routes `request`, `verify`, `me`, `signout`, `account` (`routes/auth.ts`) with 29 contract/abuse tests incl. test account and log-safety
- [x] T105 [US5] [FR-014] Wiring: `buildApp({ auth })`, CORS `DELETE`, `.env.example`
- [x] T106 [US5] [FR-015, 016] Owner CLI `npm run delete-user -- <email>` (`src/delete-user.ts`)
- [x] T107a [US1] [FR-001] Deployed 2026-10-21 with `AUTH_PEPPER` set (`ear-warrior-api`); live endpoints answer
- [x] T107b [US1] [FR-001, SC-003] `SMTP_USER`, `SMTP_PASS` set on `ear-warrior-api` and redeployed 2026-10-21 (via `server/scripts/copy-smtp.sh`). Real mail verified end to end on production: request → email arrived → verify → `me` → delete account
- [ ] T107c [US6] [FR-017, SC-009] Optional `AUTH_TEST_EMAIL` + `AUTH_TEST_CODE` for the Play reviewer, only if the store asks
- [ ] T108 [US1] [SC-003, SC-004] Measure `verify` p95 < 500 ms and mail delivery ≤ 60 s against the deployed server (quickstart §2)

## App (`src/`, `app/`)

- [x] T110 [US1] [FR-004, 010, 019] `lib/email.ts`; `services/auth/{client,messages,flow,session,service}.ts` with Jest tests (46)
- [x] T111 [US1] [FR-010] `features/auth/{authService,useAuth}.ts`; `expo-secure-store` added to dependencies
- [x] T112 [US1 US2] [FR-001, 003, 018, 019, 020] `app/sign-in.tsx` (email → code, Skip, resend countdown, announced to screen readers)
- [x] T113 [US2 US4 US5] [FR-002, 003, 013, 014] Settings → Account (sign in / email / sign out / delete, each destructive step confirmed)
- [x] T114 [US2] [FR-003] One-time sign-in offer from Home; Home button renamed "Settings"
- [x] T115a [US1 US2] [FR-010, 018] Native rebuild with `expo-secure-store`; on an Android emulator (against a local API): first-launch offer, email → code, wrong-code counter, resend limit copy, sign-in persists across app restart, sign out and delete both confirmed and verified in Postgres
- [x] T115b [US1 US2] [FR-018, 020, SC-005] Emulator checks against the production API (2026-10-21): fresh first launch shows the offer; Skip → practice works in airplane mode; offline sign-in says "Can't reach the server … keep practising"; font scale 2.0 keeps the layout; every control has a label and a ≥ 44 dp target; real e-mail code → signed in → delete account
- [ ] T115c [US2] [FR-020] Still needs a physical phone: real TalkBack speech (labels were checked from the accessibility tree only) and the first Play-bound AAB
- [x] T116a [US3] [FR-011, 012] Sentry follows `getAuthService().onAuthChange`: `setUser({ id, email })` on sign-in, `setUser({ id })` on sign-out (`src/services/observability/sentry.ts`, `app/_layout.tsx`). Not yet confirmed with a live test crash
- [ ] T116b [US3] [SC-002, SC-006] Subscribe product events to `onAuthChange` when they land (R7)

## Web and docs

- [x] T120 [US5] [FR-016] `landing/delete-account/` public deletion page; privacy page and sitemap updated
- [x] T121a [US5] [FR-016, 021] Deployed `landing/` 2026-10-21 (`earwarrior.app` re-pointed to the new deployment)
- [ ] T121b [US5] [FR-021] Fill in the Play Data Safety form (email, account id, sign-in method, deletion route)
- [x] T122 Dependencies: amendment notes in specs 001 (FR-019) and 002 (no accounts); beta checklist updated

## Found on the device

- First launch on a fresh install: an `execAsync` NullPointerException in expo-sqlite, because several screens (and the new auth service) each opened their own connection to `ear-warrior.db` while the tables were still being created. `defaultRowStore()` is now one shared store (`src/services/storage/db.ts`); two fresh-database runs after the change were clean.

- Sign-out and account deletion failed against the real server: the client sent `Content-Type: application/json` with an empty body and Fastify answered 400. Server `inject` tests did not set the header, so they passed. Fixed in `src/services/auth/client.ts` (Content-Type only with a body) with a regression test in `tests/contract/authClient.test.ts`.
