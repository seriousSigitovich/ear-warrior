# Tasks: Optional Google Sign-In

**Input**: Design documents in `/specs/022-google-sign-in/` (spec, plan, research, data-model, contracts, quickstart)
**Tests**: REQUIRED (Constitution II): every test task is written first and must fail before its implementation task.
**Format**: `- [ ] T### [P?] [US?] Description with file path` — `[P]` = different files, no dependency on an unfinished task.
**Run**: server `cd server && npm test`; app `npm test` (Node via nvm v24.15.0 prefix, see memory *Node for tests*).

## Phase 1: Setup

- [x] T001 Add `google_tickets` (columns per `data-model.md`) to the idempotent boot DDL in `server/src/db/ddl.ts` and mirror it in `server/src/db/schema.ts`
- [x] T002 [P] Add `src/auth/googleState.test.ts`, `src/auth/googleIdentity.test.ts`, `src/auth/googlePage.test.ts`, `src/routes/authGoogle.test.ts` to the `test` glob check in `server/package.json` (already globbed by `src/auth/*.test.ts` and `src/routes/*.test.ts`; confirm, change nothing if so)

## Phase 2: Foundational (blocks all stories)

**Store seam** — one atomic, single-use ticket in both stores.

- [x] T003 Add contract cases to `server/src/auth/store.contract.ts`: `issueGoogleTicket({ticketHash,email,challenge,now,expiresAt})`; `takeGoogleTicket(ticketHash, now)` returns `{email,challenge}` exactly once and `null` for unknown/used/expired; `purgeGoogleTicketsBefore(cutoff)`; also deleting a user leaves no ticket for their email usable for a different account (tickets are only trusted for 2 min — assert expiry, not cascade). Must fail (methods missing)
- [x] T004 Declare the three methods in `server/src/auth/store.ts`, implement in `server/src/auth/memoryStore.ts` (run `memoryStore.test.ts`) and `server/src/auth/pgStore.ts` (`UPDATE … SET used_at = $now WHERE ticket_hash = $h AND used_at IS NULL AND expires_at > $now RETURNING email, challenge`; run `pgStore.test.ts`)
- [x] T005 [P] Write failing tests `server/src/auth/googleState.test.ts`: `newVerifier()` is 43 chars base64url and differs per call; `challengeOf(v)` equals base64url(SHA-256(v)) (RFC 7636 appendix B vector); `signState({challenge}, pepper, now)` → `verifyState(s, pepper, now)` returns the challenge; altered payload, altered MAC, wrong pepper, state older than 10 min, garbage → `null`
- [x] T006 Implement `server/src/auth/googleState.ts` (`newVerifier`, `challengeOf`, `signState`, `verifyState`, constant-time MAC compare with `timingSafeEqual`; no I/O) to pass T005
- [x] T007 [P] Write failing tests `server/src/auth/googleIdentity.test.ts` with an injected `fetch`: success returns the normalised email; request is `POST https://oauth2.googleapis.com/token` form-encoded with `code`, `client_id`, `client_secret`, `redirect_uri`, `grant_type=authorization_code`; refusals: HTTP error, network throw, no `id_token`, `iss` not Google, `aud` ≠ client id, `exp` past (injected clock), missing `email`, `email_verified` false or the string `"false"` → typed `{ok:false, reason:'unverified_email'|'google_failed'}`
- [x] T008 Implement `server/src/auth/googleIdentity.ts` (`exchangeGoogleCode({code, config, fetch, now})`; decode the id_token payload without verifying the signature, justified by R3: it came from Google's token endpoint over TLS; reuse `normalizeEmail` from `server/src/auth/email.ts`) to pass T007
- [x] T009 [P] Write failing tests `server/src/auth/googlePage.test.ts`: success page contains an `<a href="earwarrior://sign-in?ticket=…">` and an auto-open script; each error code renders the plain-language copy from `contracts/client-google.md` and a link `earwarrior://sign-in?error=<code>`; ticket/error values are URL-encoded and HTML-escaped; page contains no other query data
- [x] T010 Implement `server/src/auth/googlePage.ts` (`returnPage({ticket}|{error})` → HTML string) to pass T009
- [x] T011 Add `googleConfigFromEnv(env)` (`clientId`, `clientSecret`, `redirectUri` from `PUBLIC_API_URL`, default `https://ear-warrior-api.vercel.app`; undefined unless both ids set) next to `authConfigFromEnv` in `server/src/routes/auth.ts`; unit-test it in `server/src/routes/auth.test.ts`

**Checkpoint**: store, state, identity and page modules green in isolation.

## Phase 3: User Story 1 — Sign in with Google (P1) 🎯 MVP

**Goal**: tap → browser → account chosen → signed in; persists across restart.
**Independent test**: `quickstart.md` §3 (server by hand) then §5 steps 1–2 (phone).

### Tests (write first, must fail)

- [x] T012 [P] [US1] `server/src/routes/authGoogle.test.ts` (`app.inject`, memory store, fake fetch, injected clock/random): `GET /api/auth/providers`; `POST /api/auth/google/start` 200 with URL containing `prompt=select_account`, `scope=openid%20email`, `redirect_uri`, signed `state`, and a verifier absent from the URL; 503 `google_disabled`; `GET /callback` happy path → 200 HTML with ticket and a ticket row stored (hash only); altered/expired state → `expired`; `error=access_denied` → `cancelled`; Google refusal → `google_failed`; unconfigured → `google_disabled`; `POST /exchange` success `{ok,token,email,created:true}` then second call `invalid_ticket`; wrong verifier → `invalid_ticket` and the ticket is burned (R9); expired ticket by clock; bad payload → 400; `/api/auth/me` works with the issued token
- [x] T013 [P] [US1] Extend `tests/contract/authClient.test.ts` (mocked fetch): `providers()` maps `google`; `googleStart()` → `{url, verifier}`; `googleExchange(ticket, verifier, deviceId)` → `{token,email,created}`; `google_disabled` and `invalid_ticket` mapped; `network` on throw; no call sends the verifier except exchange
- [x] T014 [P] [US1] `tests/unit/auth/googleFlow.test.ts`: every transition of the state machine in `contracts/client-google.md` (idle→starting→waitingForReturn→exchanging→done; cancelled is silent; error codes; double tap ignored while busy; pending verifier older than 10 min dropped); `parseGoogleReturn` accepts `ticket` or `error`, rejects unknown/oversized/both
- [x] T015 [P] [US1] Extend `tests/unit/auth/service.test.ts` (in-memory fakes): `startGoogle(openUrl)` stores the verifier under `ew.googlePending` before calling `openUrl`; `finishGoogle({ticket})` exchanges with the stored verifier and device id, writes the session, sets `signedIn`, clears pending, notifies `onAuthChange`; a return with no/expired pending → `expired` error and no request sent; `invalid_ticket` clears pending and keeps `anonymous`; `openUrl` failure → `browser_unavailable` error
- [x] T016 [P] [US1] Extend `tests/unit/auth/messages.test.ts`: every Google code in the copy table of `contracts/client-google.md` yields `{title, hint}`; `cancelled` yields none

### Implementation

- [x] T017 [US1] `server/src/routes/authGoogle.ts`: `registerAuthGoogle(app, deps)` with `providers`, `google/start`, `google/callback`, `google/exchange` per `contracts/google-auth-api.md`; reuse `store.signIn`, `generateToken`, `hashToken`; 32-byte ticket from `crypto.randomBytes`, store only its SHA-256; opportunistic `purgeGoogleTicketsBefore(now − 24 h)` in the callback; the callback logs only coded outcomes, never `code`/`state`/ticket/tokens (FR-016)
- [x] T018 [US1] Wire `registerAuthGoogle` into `server/src/app.ts` with `defaultAuthDeps()` (production `fetch`, `googleConfigFromEnv`) and add `google_tickets` to any test DB reset helper that enumerates tables
- [x] T019 [P] [US1] `src/services/auth/client.ts`: `providers`, `googleStart`, `googleExchange`, new `AuthErrorCode`s `google_disabled`, `invalid_ticket` (add to `KNOWN_CODES`)
- [x] T020 [P] [US1] `src/services/auth/googleFlow.ts`: pure state machine + `parseGoogleReturn` (T014)
- [x] T021 [US1] `src/services/auth/service.ts`: `startGoogle(openUrl)` / `finishGoogle(params)` reusing the same session/kv/`setState` path as `verify`; `ew.googlePending` key + 10-minute expiry (T015)
- [x] T022 [P] [US1] `src/services/auth/messages.ts`: Google copy table (T016)
- [x] T023 [US1] `src/features/auth/authService.ts` / `useAuth.ts`: pass `Linking.openURL` as `openUrl` into the service; expose `startGoogle`, `finishGoogle`, `googleAvailable` (from `providers()`, false on any failure)
- [x] T024 [US1] `app/sign-in.tsx`: "Continue with Google" button (shared `Button` + Nocturne tokens, Google "G" mark, label exactly "Continue with Google", accessibility label identical, ≥ 48 dp target), divider "or use an email code", shown only when `googleAvailable`; read `ticket` / `error` from `useLocalSearchParams` once and call `finishGoogle`; show copy from `messages.ts`; Skip unchanged; busy state disables the button

**Checkpoint**: US1 works end to end; server and app suites green; do quickstart §3.

## Phase 4: User Story 2 — One account across both methods (P1)

**Goal**: same verified address → same account, either order. **Independent test**: `quickstart.md` §5 step 6.

- [x] T025 [P] [US2] Add to `server/src/routes/authGoogle.test.ts`: account created by email code (`/api/auth/verify`) then Google exchange for the same address → same `userId`, `created:false`; reverse order; address differing only by case → same account; `email_verified:false` creates no user and no ticket (FR-006); two different Google addresses on one device → two users, device link moves to the later one
- [x] T026 [P] [US2] Add to `server/src/auth/store.contract.ts` (+ run in memory and pg tests): `signIn` with an existing mixed-case-stored address returns the existing user — guards the Postgres `lower(email)` lookup used by both methods
- [x] T027 [US2] Make T025/T026 pass; fix only what they reveal (expected: nothing, `signIn` already keys on the normalised email)

## Phase 5: User Story 3 — Skip, sign out, delete behave the same (P2)

**Goal**: spec 005's guarantees hold for Google sessions. **Independent test**: `quickstart.md` §5 steps 5, 7.

- [x] T028 [P] [US3] Add to `server/src/routes/authGoogle.test.ts`: a Google-issued token — `signout` revokes it and is idempotent; `DELETE /api/auth/account` removes user, sessions, links; a later Google exchange for that address returns `created:true` (a fresh account); a ticket issued before the deletion cannot resurrect the old account after its 2-minute life
- [x] T029 [P] [US3] Add to `tests/unit/auth/service.test.ts`: after `finishGoogle` then `signOut` the state is `anonymous`, the session store is empty, and nothing in the service calls any Google sign-out; `startGoogle` after sign-out opens a fresh start (new verifier), never a cached URL (FR-003)
- [x] T030 [US3] `app/settings.tsx`: add the sentence "Your Google account is not changed." to the delete-account confirmation; keep wording identical for email accounts except this line shown for all (it is true for both)
- [x] T031 [US3] Make T028/T029 pass

## Phase 6: User Story 4 — Attribution and device link (P2)

**Goal**: the email follows events after Google sign-in; earlier events become attributable; sign-out stops it.

- [x] T032 [P] [US4] Add to `server/src/routes/authGoogle.test.ts`: after exchange, `store.attributedEmail(deviceId, t)` returns the email for `t` after the link and for earlier `t` (rule in spec 005 `data-model.md`); after `signout` only events before it keep attribution and later ones are anonymous
- [x] T033 [US4] Verify the Sentry user and product-event payload follow `onAuthChange` for a Google sign-in (read `src/services/observability/sentryUser.ts` and the events payload code; add a test in `tests/unit/auth/service.test.ts` that `onAuthChange` fires `signedIn` with the email on `finishGoogle`); change code only if the subscription is keyed on the email-code path

## Phase 7: User Story 5 — Reviewer account and failure modes (P3)

**Goal**: nothing breaks for people who cannot use Google.

- [x] T034 [P] [US5] Add to `server/src/routes/auth.test.ts`: with Google configured, the spec-005 test account (fixed email + code) and the rate limits behave exactly as before (FR-017)
- [x] T035 [P] [US5] Add to `tests/unit/auth/googleFlow.test.ts` and `service.test.ts`: offline (`network`) at start and at exchange → actionable error, state back to idle, no pending verifier left at start failure; `google_disabled` hides nothing else; a return link arriving on an install whose `providers()` was false is still handled
- [x] T036 [US5] Hide the Google control when `googleAvailable` is false in `app/sign-in.tsx` (already built in T024: verify with a screen-level manual check, quickstart §5 step 1) and make sure the email form and Skip render identically in that case

## Phase 8: Polish & cross-cutting

- [x] T037 [P] Privacy and store copy (FR-018): add the sentence "If you sign in with Google, Google tells us your email address and nothing else" to the privacy page under `landing/` and to the Data Safety notes in `docs/play-console.md`
- [x] T038 [P] Update `docs/beta-checklist.md`: replace the "Вход через Google … SHA-1" item with the owner setup of `quickstart.md` §2 (separate project, Web client, two Vercel env vars) and the OTA step; add an amendment note ("Google: see spec 022") to `specs/005-user-auth/spec.md` Clarifications
- [x] T039 [P] Lint, format, typecheck as the repo does (`npm run lint` if present; `cd server && npx tsc --noEmit`); memory note says `typecheck:app` is pre-broken by expo, so judge only files touched here
- [x] T040 Full suites green: `cd server && npm test` and `npm test`; record the counts in the final report
- [ ] T041 Owner-only, not automatable (list in the final report, do not claim done): Google Cloud project + Web client + consent screen published; `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` on Vercel; server deploy before OTA; real-phone checks `quickstart.md` §5 (browser return, auto-return yes/no); `eas update`

## Dependencies & order

- Phase 1 → Phase 2 → US1 → (US2, US3, US4, US5 can follow in any order; all only add tests and tiny fixes on top of US1) → Polish.
- Inside Phase 2: T003→T004; T005→T006; T007→T008; T009→T010; T011 independent. All five chains are parallel to each other.
- Inside US1: tests T012–T016 are parallel; then T017→T018 (server), T019/T020/T022 parallel, T021 after T019/T020, T023 after T021, T024 last.

## Parallel example (Phase 2)

```text
Chain A: T003 → T004   (store)        Chain B: T005 → T006   (state)
Chain C: T007 → T008   (identity)     Chain D: T009 → T010   (page)
```

## Implementation strategy

1. **MVP = Phases 1–3** (US1): server flow + the button, testable by hand with `curl` before any phone.
2. Then US2 (the data-integrity guarantee) before anyone is told about the button.
3. US3–US5 are verification phases; the real risk is the phone-side browser return (R4), checked in `quickstart.md` §5 before the OTA.
