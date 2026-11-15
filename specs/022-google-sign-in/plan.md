# Implementation Plan: Optional Google Sign-In

**Branch**: `022-google-sign-in` (created 2026-11-15 from `master`) | **Date**: 2026-11-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/022-google-sign-in/spec.md`

## Summary

A second, optional way to sign in: "Continue with Google". The identity is the **verified email**, the same key as the email code, so
both methods open one account (FR-005) and everything downstream — session, device link, attribution, deletion, progress sync (019) —
is reused unchanged.

**Technical approach** (details in [research.md](./research.md)):

- **Server-mediated browser flow** (R1): the app calls `POST /api/auth/google/start` → gets a Google URL and a secret verifier → opens
  the system browser → Google account chooser → server callback exchanges the code with Google, validates the identity claims and issues a
  one-time **ticket** → return page deep-links `earwarrior://sign-in?ticket=…` → app calls `POST /api/auth/google/exchange` with
  ticket + verifier → gets the same `{ token, email, created }` as the email code. One new table (`google_tickets`); `AuthStore.signIn`
  is reused as is.
- **No new native module and no new dependency**: the app uses `Linking` and expo-router deep links (already in the binary); the server
  uses `fetch` and `node:crypto`. The feature therefore ships to the current beta build by **OTA** — and does not depend on the Play App
  Signing SHA-1.
- **App**: pure logic in `src/services/auth/` (client methods, `googleFlow.ts` state machine, service methods, error copy), UI changes in
  `app/sign-in.tsx` and one sentence in `app/settings.tsx`'s delete confirmation. The button is shown only if `GET /api/auth/providers`
  says Google is configured (R6).
- **Owner steps** (not code): a separate Google Cloud project with an External consent screen (scopes `openid email`, published) and a Web
  OAuth client; two env vars on Vercel; privacy page + Data Safety text (R7, FR-018).

## Technical Context

**Language/Version**: TypeScript — server `~5.6` on Node 20 (ESM, `tsx`); app `~5.3`, React Native 0.86, Expo SDK 57

**Primary Dependencies**: none added. Server: Fastify 5, Drizzle 0.36, `postgres`, zod, `node:crypto`, global `fetch`. App: expo-router (deep links), React Native `Linking`

**Storage**: Postgres — new table `google_tickets`; device — one SQLite key-value entry `ew.googlePending` (verifier + start time)

**Testing**: server — `node:test` via `tsx --test` (`src/auth/*.test.ts`, `src/routes/*.test.ts`), in-memory store + injected `fetch`/clock; app — Jest (ts-jest, node env, pure logic only). Tests first (Constitution II)

**Target Platform**: Android (closed beta) via OTA to the existing build; server on Vercel. iOS not in scope

**Project Type**: mobile app + existing web-service (`server/`)

**Performance Goals**: `callback` ≤ 1.5 s server time (one call to Google's token endpoint); `start` and `exchange` p95 < 300 ms; learner-side SC-003 (picked account → signed in ≤ 3 s) and SC-001 (≤ 4 taps, ≤ 20 s); practice loop budgets unchanged (no Google call is on the loop's path)

**Constraints**: offline practice unaffected; no in-memory server state (stateless serverless: state is HMAC-signed, ticket is in Postgres); ticket, verifier, `code`, `state`, Google tokens and session tokens never logged (FR-016); the app is never trusted for identity (FR-007); no cryptography or randomness in the app (R2)

**Scale/Scope**: ~14 beta users; 1 route file (`routes/authGoogle.ts`), 3 small server modules, 1 table, 3–4 app modules, 1 screen edit

## Constitution Check

*GATE: passed before Phase 0; re-checked after Phase 1 design (below).*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Code Quality | New deps defensible vs. simpler alternative; no dead code; match conventions (`registerX(app, deps)`, injectable store/clock/fetch, idempotent boot DDL) | PASS — **zero** new dependencies (R1, R3); layout copies `routes/auth.ts`; `AuthStore.signIn` reused rather than a parallel path |
| II. Test-First (NON-NEGOTIABLE) | Failing tests first; contract tests for every endpoint; deterministic; coverage not regressing | PASS — contract-test list in `contracts/google-auth-api.md`; every rule is in an injectable module; Google is faked with an injected `fetch`; app logic is pure Jest |
| III. UX Consistency | Shared components, actionable errors, destructive confirm, a11y baseline | PASS — copy table in `contracts/client-google.md`; button built from the shared `Button`/Nocturne tokens + Google brand rules; delete confirmation extended, not new; FR-015 ties to spec 004 |
| IV. Performance | Declared budgets, measured | PASS — budgets above; server timings measured in `quickstart.md` §4 |

No violations → Complexity Tracking is empty. **Post-design re-check**: still PASS (design added one table and no dependency).

## Project Structure

### Documentation (this feature)

```text
specs/022-google-sign-in/
├── spec.md
├── plan.md            # this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── google-auth-api.md
│   └── client-google.md
├── checklists/requirements.md
└── tasks.md           # /speckit-tasks
```

### Source Code (repository root)

```text
server/src/
├── auth/
│   ├── googleState.ts        # sign/verify the OAuth state; verifier + challenge helpers (pure)
│   ├── googleIdentity.ts     # Google token-endpoint exchange + claim validation, fetch injected
│   ├── googlePage.ts         # the return page HTML (success + error copy)
│   ├── store.ts              # + issueGoogleTicket / takeGoogleTicket (atomic, single use)
│   ├── memoryStore.ts        # + same
│   ├── pgStore.ts            # + same
│   └── store.contract.ts     # + contract cases both stores must pass
├── routes/authGoogle.ts      # providers, google/start, google/callback, google/exchange
├── db/{ddl.ts,schema.ts}     # + google_tickets
└── app.ts                    # register the route

src/services/auth/
├── client.ts                 # + providers, googleStart, googleExchange, error codes
├── googleFlow.ts             # state machine + deep-link parser (pure)
├── service.ts                # + startGoogle / finishGoogle
└── messages.ts               # + Google error copy
src/features/auth/            # wire Linking.openURL into the service instance
app/sign-in.tsx               # button, return-link handling, "or use an email code"
app/settings.tsx              # delete-confirmation sentence
landing/                      # privacy page sentence (FR-018)

tests/ (app)  unit/auth/{googleFlow,service,messages}.test.ts, contract/authClient.test.ts
server tests  auth/{googleState,googleIdentity,googlePage}.test.ts, routes/authGoogle.test.ts, store contract in memory + pg tests
```

**Structure Decision**: extend the existing `server/src/auth` + `routes` and `src/services/auth` modules; no new top-level package.

## Complexity Tracking

*(none)*

## Rollout

1. Land code on the branch; server tests green (`cd server && npm test`), app tests green (`npm test`).
2. Owner: create the Google project/client (R7), set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` on Vercel, deploy the server **before** the OTA (as for funnel events): until then `providers` says `google: false` and nobody sees the button.
3. Real-phone check of the browser round-trip (quickstart §5); then `eas update` (see memory *OTA publish env*); then update `docs/beta-checklist.md` and the spec 005 amendment note.
