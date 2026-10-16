# Implementation Plan: Social Analytics Dashboard (YouTube + Instagram)

**Branch**: `006-social-analytics` (not created — landed on `master`) | **Date**: 2026-10-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-social-analytics/spec.md`

**Note**: **Retroactive.** This plan documents the architecture *as built* (commits `fea8436`, `10d5cd3`, `0d41b16`); the Constitution Check is evaluated honestly against what was actually done, and the gaps become tasks.

## Summary

A collector pulls per-post metrics from YouTube (Data API for counters + Analytics API for watch behaviour) and Instagram (Graph API with Instagram Login) into Postgres as **one snapshot per post per UTC day**. A server-rendered, Basic-auth page at `/admin/social` turns snapshots into "what happened in the last N days" — the pure aggregation lives in one tested module, so unknown growth is never rendered as a number. Collection is a CLI (`npm run collect`), a manual button (cooldown) or an optional in-process timer.

## Technical Context

**Language/Version**: TypeScript 5.6 on Node 20 (ESM), same as `server/`

**Primary Dependencies**: Fastify 5, Drizzle ORM + `postgres` (postgres-js), zod; platform APIs are called with the global `fetch` — **no SDKs, no new runtime dependency**

**Storage**: Postgres (existing `server/` database); tables created by the idempotent boot DDL (`server/src/db/ddl.ts`) and mirrored in `schema.ts`

**Testing**: `node:test` run through `tsx` (`npm test` in `server/`) — the repo's Jest runner covers only `src/` of the app; collectors are tested against a scripted fake `fetch`

**Target Platform**: Linux container (existing Dockerfile) / macOS dev; **no production host is recorded yet** (see spec Open Questions)

**Project Type**: web-service (extends `server/`; page is server-rendered HTML, no client JS)

**Performance Goals** (declared now, constitution IV): page render **p95 < 200 ms** at ≤ 500 posts × 90 days of snapshots; one full collection **< 60 s** for ≤ 100 posts per platform; Instagram uses ≤ 1 insights request per post in the normal case

**Constraints**: read-only platform scopes; secrets never in logs/pages/errors; page 404 without `ADMIN_PASSWORD`; manual collection ≥ 2 min apart; platform quotas (YouTube Data units, Instagram rate limits) respected by one collection per day

**Scale/Scope**: hundreds of posts, ≤ 90–365 daily snapshots each, one owner

## Constitution Check

*GATE: evaluated retroactively. Gaps are recorded in Complexity Tracking and as tasks.*

| Principle | Status | Evidence / gap |
|---|---|---|
| I. Code quality | **Partial** | Matches surrounding conventions (comments explain *why*, small modules, no dead code, no dependency added). **Gap:** `server/` has no linter/formatter configured, so "a green linter" cannot be a merge gate → T020. `eslint-disable` comments in `collect.ts`/`youtube-auth.ts` are inert until one exists. |
| II. Test-first | **Violated (recorded)** | Tests were written *alongside/after* the code, not first. Core rules (window growth, token scrubbing, escaping, collectors incl. error paths) have tests: 22 passing. **Gaps:** no test of `routes/social.ts` (auth matrix, cooldown, 404 without password), `store.ts`/`collect.ts` against a real Postgres, or `youtube-auth.ts` → T021–T023; no coverage measurement for `server/` → T031. |
| III. UX consistency | **Partial** | Failures are shown as text with the platform's message; unknown ≠ 0 is applied everywhere. **Gaps:** error text is shown raw (not always "what to do next"); a failed chip does not say how old the last good data is (spec FR-007) → T032; the page was not audited for keyboard/contrast (native `<details>` and links only); copy is Russian while the product is English (owner-only page — accepted, recorded) → T024. |
| IV. Performance | **Declared now** | Targets above were not declared before implementation. Measured 2026-10-16 on real data (27 posts × 1 day): **15–24 ms**, 46 KB. **Gap:** not measured at the declared scale; `loadAll()` reads every snapshot into memory (linear) → T025 (seed 500×90, measure; paginate/aggregate in SQL if over budget); collection time (< 60 s for ≤ 100 posts): first live measure 2026-10-16 — both platforms, 27 + 22 posts, ≈ 20 s wall; not yet measured at 100 posts or in the fallback case → T033. |

**Post-design re-check**: no new violations introduced by the design below; the four gaps stand and are tracked.

## Project Structure

### Documentation (this feature)

```text
specs/006-social-analytics/
├── spec.md
├── plan.md              # this file
├── research.md          # decisions & alternatives
├── data-model.md        # tables, snapshot semantics, window rules
├── quickstart.md        # run & validate end to end
├── contracts/
│   ├── http-routes.md   # /admin/social, /admin/social/collect
│   └── collector-interface.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
server/
├── src/
│   ├── db/{ddl.ts, schema.ts}          # + social_* tables (idempotent DDL, Drizzle mirror)
│   ├── routes/social.ts                # page + manual collect, Basic auth, cooldown
│   ├── social/
│   │   ├── types.ts                    # Collector contract, PostInfo/PostMetrics, parseVideoNo
│   │   ├── http.ts                     # getJson, HttpError, scrubUrl (token-safe errors)
│   │   ├── youtube.ts                  # Data API + Analytics API
│   │   ├── instagram.ts                # Instagram Login API, token refresh, per-metric fallback
│   │   ├── store.ts                    # upserts, runs, tokens, loadAll
│   │   ├── collect.ts                  # runs configured collectors independently, logs runs
│   │   ├── summary.ts                  # PURE: windowGain, buildDashboard, sortPosts
│   │   ├── page.ts                     # PURE: renderPage (escaped HTML string)
│   │   ├── oauth.ts                    # PURE: buildAuthUrl, setEnvVar
│   │   └── *.test.ts                   # node:test
│   ├── collect.ts                      # CLI: npm run collect
│   └── youtube-auth.ts                 # CLI: npm run yt:auth (loopback OAuth)
├── README.md                           # "Social analytics" section, setup steps
└── .env.example
landing/privacy/index.html              # dependency: OAuth consent needs a privacy policy URL
```

**Structure Decision**: extend the existing `server/` rather than add a service — it already owns Postgres, deployment and the "only a node layer" rule (memory `backend-node-migration`). I/O is kept at the edges (`youtube.ts`, `instagram.ts`, `store.ts`, `routes/`), and the logic that decides what the owner reads (`summary.ts`, `page.ts`) is pure and unit-tested.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| II: tests not written first | Feature was built exploratory, in one session, before a spec existed | Cannot be undone; mitigated by tests for every rule that decides what the owner reads, and by T021–T023 + T031 (coverage) for the untested edges. **Accepted by the owner on 2026-10-16** after `/speckit-analyze` (finding C1: the constitution calls II non-negotiable yet Governance allows recorded exceptions — accepted here as a recorded exception; constitution unchanged) |
| I: no linter in `server/` | Repo has none for this package; adding tooling was out of scope of the feature | Left as T020 so it is a tracked gate, not an ignored one |
| III: dashboard copy in Russian | Single Russian-speaking owner, internal page | Translating adds nothing now; revisit if anyone else gets access |
