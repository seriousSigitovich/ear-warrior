---

description: "Task list for 006-social-analytics (retroactive: built tasks checked, gaps open)"
---

# Tasks: Social Analytics Dashboard (YouTube + Instagram)

**Input**: Design documents from `specs/006-social-analytics/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Retroactive**: this feature was built before it was specified (commits `fea8436`, `10d5cd3`, `0d41b16`). `[x]` = built and verified as stated; `[ ]` = open. **Numbering**: T001–T019 are the built work; T020–T030 are the open work and keep fixed numbers because `plan.md` (Constitution Check) refers to T020–T025. They are grouped under the user story they serve, so IDs are not in file order.

**Tests**: required by the constitution (Principle II). Built tasks carry the tests that exist; missing tests are open tasks (T021–T023).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US5 from spec.md (Setup, Foundational and Polish carry none)

## Path conventions

All paths are relative to the repository root; the backend is `server/` (see plan.md → Project Structure).

---

## Phase 1: Setup

- [x] T001 Add `social_posts`, `social_snapshots`, `social_account_snapshots`, `social_tokens`, `social_runs` to the idempotent boot DDL in `server/src/db/ddl.ts` and mirror them in `server/src/db/schema.ts`
- [x] T002 [P] Define the `Collector` contract, `PostInfo`/`PostMetrics` (all-nullable), `emptyMetrics()` and `parseVideoNo()` in `server/src/social/types.ts`
- [x] T003 [P] Token-safe HTTP helper (`getJson`, `HttpError`, `scrubUrl`) in `server/src/social/http.ts`
- [x] T004 [P] Config surface: `server/.env.example` (ADMIN_*, YT_*, IG_*, SOCIAL_COLLECT_INTERVAL_HOURS), `server/package.json` scripts (`test`, `collect`, `yt:auth`, `--env-file=.env`), `server/tsconfig.json` excludes `*.test.ts`

## Phase 2: Foundational (blocks every user story)

- [x] T005 Persistence in `server/src/social/store.ts`: `saveCollected` (transactional upserts, same-day overwrite), `tokenStore`, `startRun`/`finishRun`, `latestRuns`, `lastRunStartedAt`, `loadAll`
- [x] T006 Pure aggregation in `server/src/social/summary.ts` (`windowGain`, `buildDashboard`, `sortPosts`) with tests in `server/src/social/summary.test.ts` (baseline present/absent, born-in-window, not-yet-born, counter decrease, platform sum unknown-if-any-unknown, followers delta, sort order) — covers FR-005, SC-003
- [x] T007 Orchestrator in `server/src/social/collect.ts`: configured collectors run independently, each writes a `social_runs` row, failure never stops the others, single-flight guard

**Checkpoint**: data can be collected and aggregated; stories below add the sources and surfaces.

---

## Phase 3: User Story 1 — See how the channels are doing at a glance (P1) 🎯 MVP

**Goal**: one page answers "what happened in the last N days?" per platform.
**Independent Test**: collect one platform, open the page → card with views/period, followers, best post, top list; before a window of history exists it shows lifetime totals and says why.

- [x] T008 [US1] Render in `server/src/social/page.ts`: period selector (7/28/90), platform cards with growth / change vs previous window / followers delta / best post, "what worked" list with sparklines, lifetime fallback text; tests in `server/src/social/page.test.ts` (empty state, `ago`)
- [x] T009 [US1] `GET /admin/social` in `server/src/routes/social.ts` (query parsing with safe fallbacks, `no-store`), registered in `server/src/app.ts`; verified on real YouTube data 2026-10-16 (27 posts, 9 516 views, 7 subscribers) and on synthetic data at desktop and phone width

## Phase 4: User Story 2 — Trust that the numbers are current (P1)

**Goal**: never read stale data as fresh.
**Independent Test**: break one platform's credentials, run a collection → that platform shows a failure with its message; the other is unaffected.

- [x] T010 [US2] Status chips per platform (not connected / never collected / updated N ago / failed + message) in `server/src/social/page.ts`; `POST /admin/social/collect` with a 2-minute cooldown (`303` for HTML clients, `429`/JSON otherwise) in `server/src/routes/social.ts`
- [x] T011 [P] [US2] CLI `server/src/collect.ts` (`npm run collect`, exit code 1 if any configured platform failed)
- [x] T012 [P] [US2] Optional in-process scheduler (`SOCIAL_COLLECT_INTERVAL_HOURS`) in `server/src/server.ts`
- [ ] T032 [US2] Show the age of the last **good** data when the latest run failed (spec FR-007): add a query for the latest `ok = true` run per platform in `server/src/social/store.ts`, pass it into `statusStrip` in `server/src/social/page.ts` so a failed chip reads e.g. «ошибка последнего сбора · последние данные: 3 дн назад», and test both branches (never succeeded; succeeded earlier then failed) in `server/src/social/page.test.ts`
- [ ] T022 [US2] Integration test of `store.ts` + `collect.ts` against a real Postgres (docker compose): same-day overwrite keeps one row, a failing collector records `ok=false` with a scrubbed message while the other platform's data is saved, cooldown reads `lastRunStartedAt`. File: `server/src/social/store.integration.test.ts`, run via a separate `npm run test:integration` so `npm test` stays database-free

## Phase 5: User Story 3 — Drill into one post (P2)

**Goal**: all metrics + views over time on demand, to compare hook variants.
**Independent Test**: expand a post → reported metrics only, chart, link; sort and platform filter reorder the list.

- [x] T013 [US3] Per-post `<details>` with reported metrics, cumulative-views chart, link, sort (growth/views/date) and platform filter in `server/src/social/page.ts`; experiment number parsed by `parseVideoNo` (tested in `server/src/social/collectors.test.ts`)
- [ ] T028 [US3] **Decide, then implement** the mapping posts → hypotheses (H-ids / video numbers from `docs/experiments.md`): choose between a rule on titles, a manual map table, or editing titles; add the chosen source, show the hypothesis id next to the post, test it. Files: `specs/006-social-analytics/spec.md` (record decision), then `server/src/social/{types,summary,page}.ts` + tests
- [ ] T029 [US3] Join waitlist `source` tags (`youtube:ear16`, from the landing signup flow in `landing/api/_store.js` / `signups.source`) with posts so signups per video are visible next to views; decide the read path first (Postgres `signups` vs Upstash `signup_sources`, see spec 003 Open Questions). Files: `server/src/social/store.ts`, `summary.ts`, `page.ts` + tests

## Phase 6: User Story 4 — Connect a platform once and forget it (P2)

**Goal**: one-time setup, collection keeps working.
**Independent Test**: from a clean state follow the README → a collection returns the channel's posts; Instagram token renews itself.

- [x] T014 [US4] YouTube collector `server/src/social/youtube.ts` (Data API counters + Analytics API watch behaviour, analytics failure non-fatal); tests in `server/src/social/collectors.test.ts`; **verified live 2026-10-16**
- [x] T015 [US4] Instagram collector `server/src/social/instagram.ts` (token refresh persisted in `social_tokens`, per-metric fallback, account insights non-fatal, no token in errors); tests in `server/src/social/collectors.test.ts` against scripted responses; **verified live 2026-10-16 (T026)** — metric set corrected after a live probe
- [x] T016 [US4] One-time YouTube authorization: pure helpers `server/src/social/oauth.ts` + CLI `server/src/youtube-auth.ts` (`npm run yt:auth`, loopback callback, state check, token written to `.env`, never printed); helper tests in `server/src/social/collectors.test.ts`; used successfully on 2026-10-16
- [x] T017 [US4] Google Cloud setup: project `ear-warrior-analytics`, YouTube Data + Analytics APIs enabled, consent screen branded and **published to Production**, Web client with redirect `http://localhost:8765/callback`; steps in `server/README.md` → "Connect YouTube"
- [x] T018 [US4] Privacy page required by the consent screen (FR-016): `landing/privacy/index.html` (+ footer link in `landing/index.html`, `landing/sitemap.xml`), deployed to production, `https://earwarrior.app/privacy/` → 200
- [ ] T023 [US4] Test `youtube-auth.ts`: extract the callback handling into a function in `server/src/social/oauth.ts` (state mismatch → 400 and exit code 1, missing `code`, no `refresh_token` in the response → explicit message and `.env` untouched, success → only `YT_REFRESH_TOKEN` line changed) and cover it in `server/src/social/oauth.test.ts`
- [ ] T034 [US4] Make `landing/privacy/index.html` match reality (analyze I4): list only the signup sinks that are actually live — check which of `KV_REST_API_URL`/`UPSTASH_*` (Upstash), `SMTP_USER` (email notification) and `API_URL` (own server) are set with `npx vercel env ls` in `landing/`, remove processors that are not used, update the "Last updated" date, redeploy with `npx vercel deploy --prod --yes`, and confirm `https://earwarrior.app/privacy/` returns 200 with the new text
- [x] T026 [US4] Connect Instagram live — done 2026-10-16: Meta app «Ear Warrior Analytics» (Instagram API with Instagram Login), permissions `instagram_business_basic` + `instagram_business_manage_insights`, tester role accepted for `earwarrior`, token in `server/.env`; `npm run collect` → 22 posts. Live probe found `follows`/`profile_visits`/`profile_activity` unsupported for reels → removed from the request (`server/src/social/instagram.ts`), regression test in `server/src/social/collectors.test.ts`; result recorded in `spec.md`
- [ ] T027 [US4] Decide where the daily collector runs in production (the server currently runs only on the author's machine): options — deploy `server/` (Dockerfile exists) with `SOCIAL_COLLECT_INTERVAL_HOURS`, or an external scheduler calling `node dist/collect.js`. Record the decision in `specs/006-social-analytics/plan.md` and, if a deploy is chosen, add its steps to `server/README.md`

## Phase 7: User Story 5 — Keep it private and safe (P3)

**Goal**: only the owner reaches the page; hostile text and secrets cannot leak.
**Independent Test**: request with no/wrong credentials and with no password configured; render markup in a title.

- [x] T019 [US5] Basic auth (constant-time compare), 404 without `ADMIN_PASSWORD`, `noindex`, escaping of all platform text, token scrubbing in errors — `server/src/routes/social.ts`, `server/src/social/page.ts`, `server/src/social/http.ts`; tests for escaping in `server/src/social/page.test.ts` and for token-free errors in `server/src/social/collectors.test.ts`; 401/401/200 checked manually on 2026-10-16
- [ ] T021 [US5] Route tests with Fastify `inject` in `server/src/routes/social.test.ts`: no password configured → 404 on both routes; missing/wrong credentials → 401 with `WWW-Authenticate`; correct credentials → 200 HTML with `no-store`; invalid `days`/`sort`/`platform` fall back to defaults; cooldown → 429 JSON / 303 for HTML (store functions stubbed). Add the file to the `npm test` glob in `server/package.json`

---

## Phase 8: Polish & cross-cutting (constitution gaps)

- [ ] T020 [P] Linter + formatter for `server/` (ESLint with typescript-eslint, Prettier): add configs, `npm run lint` / `format:check`, fix findings in `server/src/**`, remove the now-meaningful `eslint-disable` comments only if unneeded — Principle I
- [ ] T024 [P] Accessibility pass on `server/src/social/page.ts`: contrast ≥ 4.5:1 for muted text and badges, visible keyboard focus on links/`<details>`/buttons, `aria-label`s for charts, keyboard operation verified, error chips say what to do next (e.g. "token expired — run `npm run yt:auth`") instead of raw text only — Principle III
- [ ] T025 Measure render time at the declared scale (500 posts × 90 snapshots) against the 200 ms p95 budget: seed a scratch database, time `GET /admin/social` 50×, record p95 in `plan.md`; if over budget, aggregate in SQL or load only the needed window in `server/src/social/store.ts` (`loadAll`) — Principle IV
- [ ] T031 [P] Test coverage for `server/` (analyze C2, constitution II "coverage MUST NOT regress"): add `npm run test:coverage` (`tsx --test --experimental-test-coverage` over all `*.test.ts`, or c8), record the baseline for `server/src/social/` and `server/src/routes/social.ts` in `plan.md`, and fail the script if line coverage of those paths drops below the recorded baseline
- [ ] T033 Measure collection time against the plan's budget (< 60 s for ≤ 100 posts per platform; analyze G1): `server/src/social/collect.perf.test.ts` drives the Instagram collector with a fake `fetch` delayed 300 ms per call for 100 posts, in the normal case (1 insights call per post) and the worst case (per-metric fallback, up to 7 calls per post); if the worst case exceeds 60 s add bounded concurrency (e.g. 4 in parallel) in `server/src/social/instagram.ts`, and record the result in `plan.md`
- [x] T030 Commit the silencing of boot-DDL notices (`onnotice` in `server/src/db/client.ts`) and run `/speckit-analyze` on this feature — done 2026-10-16: notices are a separate commit from the specs commit; findings folded in as T031–T034, spec 003 Assumptions fixed (I3), C1 accepted as a recorded exception (plan.md → Complexity Tracking)

---

## Dependencies & execution order

- Setup (T001–T004) → Foundational (T005–T007) → stories. US1 and US2 (both P1) share only Foundational; US3–US5 need T008/T009 for the page.
- T021, T022, T023 are independent of each other ([P]-able) and unblock "Definition of Done" for US5/US2/US4. T031 needs T021–T023 to report meaningful coverage; T022 must reconcile with the constitution's "single command" rule (analyze C3): either `npm test` runs it when Postgres is reachable and skips otherwise, or the deviation is recorded in `plan.md`.
- T032 needs T005 (store) and T008 (page); T034 needs no code but a production redeploy of `landing/`.
- T026 → T015 live verification; T027 gates trusting any trend (without a host, history has gaps).
- T028/T029 each begin with a decision recorded in `spec.md`, then implementation.

## Parallel opportunities

- Built: T002, T003, T004 together; T011, T012 together.
- Open: T020 ∥ T021 ∥ T022 ∥ T023 ∥ T024 (different files); T025 after any change to `store.ts`.

## Independent test per story

| Story | Test |
|---|---|
| US1 | collect one platform → open page → card + top list; day one shows lifetime fallback |
| US2 | break one platform's credentials → that chip fails with message, other unaffected |
| US3 | expand a post → reported metrics, chart, link; sort/filter work |
| US4 | clean setup per README → posts returned; Instagram token renews |
| US5 | 404 without password, 401 wrong credentials, markup in a title is inert |

## Implementation strategy

**MVP = US1 + US2** (built; YouTube live). Next increment, in order: **T021 → T022 → T023 → T031** (close the test gaps and measure them), **T027** (host — without it nothing accumulates), **T032** (stale-data honesty), **T034** (privacy accuracy), then T020/T024/T025/T033, and finally the product-value tasks T028/T029 that tie views to hypotheses and signups.

## Summary

| | Count |
|---|---|
| Total tasks | 34 |
| Built `[x]` | 21 (T001–T019, T026, T030) |
| Open `[ ]` | 13 (T020–T025, T027–T029, T031–T034) |
| Setup / Foundational / Polish | 4 / 3 / 6 |
| US1 / US2 / US3 / US4 / US5 | 2 / 5 / 3 / 9 / 2 |

IDs T031–T034 were added after `/speckit-analyze` on 2026-10-16 (C2 → T031, I1 → T032, G1 → T033, I4 → T034); T020–T030 keep the numbers `plan.md` refers to.
