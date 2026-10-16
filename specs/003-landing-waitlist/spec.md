# Feature Specification: Landing Page & Founding-Members Waitlist

**Feature Branch**: `003-landing-waitlist` (not created — work landed on `master`)

**Created**: 2026-10-11 (**retroactive**: built before this spec; requirements are read from `landing/`,
`landing/api/*.js` and `server/src/routes/subscribe.ts`)

**Status**: Draft — live on Vercel (project `ear-warrior-landing`), open questions below

**Input**: Give people who see a challenge video somewhere to land, tell them what the app is, and collect an
email so they can be told at launch. The page is the conversion step of the social-video experiments in
`docs/experiments.md`.

## Clarifications

### Session 2026-10-11 (recorded from the implementation — confirm or correct)

- Q: What does a visitor give and get? → A: An **email** (no account) and, for the first **100** signups, the label "founding member #N" with a promise of **lifetime access**. Everyone else is told they are on the list.
- Q: Where does a signup go? → A: `POST /api/subscribe` on the landing's own Vercel function, which (1) registers the email in an Upstash Redis sorted set (dedup, position, total, and first-touch `source`), and (2) forwards it to a sink — an email to the owner (SMTP) or the Fastify server's `/api/subscribe` (Postgres `signups`, dedup by `lower(email)`). First configured sink wins.
- Q: How is acquisition measured? → A: Each signup records the **first-touch `source`** (e.g. `youtube:ear16`), and the page emits named events (e.g. `email-focus`, `signup-ok`) to **Vercel Web Analytics** (cookie-less).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Join the waitlist (Priority: P1)

As a visitor, I want to leave my email and know it worked, so that I hear when the app launches.

**Why this priority**: It is the only conversion the page exists for. **Independent Test**: submit a valid
email on the deployed page → success state shown, signup recorded once, repeat submit does not duplicate.

**Acceptance Scenarios**:

1. **Given** a valid email, **When** the form is submitted, **Then** the page shows success and the signup is stored.
2. **Given** an email already registered, **When** it is submitted again, **Then** the page still shows success and no duplicate is stored; the original `source` is kept.
3. **Given** one of the first 100 signups, **When** it succeeds, **Then** the page shows the founding-member number.
4. **Given** an invalid email, **When** submitted, **Then** the field is focused with a validation message and nothing is sent.
5. **Given** the backend fails, **When** submitted, **Then** an error state is shown, the button is re-enabled and the visitor can retry.
6. **Given** a bot fills the hidden `company` field, **When** submitted, **Then** it silently "succeeds" and nothing is stored.

### User Story 2 - See the counter (Priority: P2)

As a visitor, I want to see how many founding spots are left, so that I understand the offer.

**Acceptance Scenarios**:

1. **Given** the store is configured, **When** the page loads, **Then** it shows the count out of the cap (100); the count is edge-cached ~30 s so a traffic spike costs ~one store read per half minute.
2. **Given** no store is configured or the read fails, **When** the page loads, **Then** the counter is hidden and signup still works.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The page MUST describe the product accurately for its current positioning (guitarists; hear a melody, find it by ear) and MUST NOT promise features the app does not have.
- **FR-002**: `POST /api/subscribe { email, source?, company? }` MUST validate the email, treat a filled `company` honeypot as success without storing, and be idempotent per email (case-insensitive).
- **FR-003**: The first-touch `source` MUST be kept per email and MUST NOT be overwritten by a later signup.
- **FR-004**: The founding-members cap is **100**; signup position is stable and returned to the page.
- **FR-005**: The page MUST work with no store and no sink configured (counter hidden, signup degrades without breaking the form).
- **FR-006**: Collected data MUST be limited to email, `source`, user-agent (truncated) and signup time; no cookies, no tracking beyond cookie-less Web Analytics.
- **FR-007**: The page MUST meet the project's accessibility baseline (labelled form field, visible error state, contrast ≥ 4.5:1) — constitution III.

### Key Entities

- **Signup**: email (lower-cased), first-touch `source`, signup time, user-agent; position derived from order.

## Success Criteria *(mandatory)*

- **SC-001**: A valid signup completes in one submit and shows success in under 2 s on a normal connection.
- **SC-002**: 100 % of repeat submits of one email produce exactly one stored signup.
- **SC-003**: Every signup is attributable to a `source` (default `landing`), so each video's conversion can be computed against its views.
- **SC-004**: The page is fully usable at phone width without horizontal scroll.

## Assumptions

- Hosting is Vercel; the Redis store comes from the Vercel Marketplace (Upstash). The public domain `earwarrior.app` is **live on Vercel** (answers 200 since 2026-10-11) and now links a privacy policy at `/privacy/` (2026-10-16, see spec 006 FR-016).
- Traffic is bursty (a video can go viral), so reads are cached and writes are O(1).

## Open Questions (not decided — owner to resolve)

- **Lifetime access is a commercial promise.** The page tells the first 100 signups they get "lifetime access". Is that decided pricing, and is it written down anywhere other than the page? If not, either record the decision or soften the copy.
- **Two stores, one concept.** Signups land in Upstash (counter) **and** may land in Postgres `signups` (via the Fastify server) or in an inbox — three places, no reconciliation. Which is the source of truth?
- **Consent & unsubscribe.** "One email when we launch" implies a single mail; there is no recorded consent text or unsubscribe path. Needed before emailing at launch?
- **Positioning drift.** Copy is being rewritten for guitarists (memory: positioning decided 2026-10-09). The spec's FR-001 should be re-checked after each rewrite.

## Verification status

- **No automated tests** for `landing/api/*.js` or `server/src/routes/subscribe.ts` — a gap against Constitution II (a user-facing contract). Tracked below.

## Tasks (retroactive)

- [ ] T001 Contract tests for `landing/api/subscribe.js` (valid, invalid, honeypot, repeat submit keeps first `source`, no store configured)
- [ ] T002 Contract test for `landing/api/count.js` (configured, unconfigured, store error → `count: null`)
- [ ] T003 Route tests for `server/src/routes/subscribe.ts` (invalid email → 400, honeypot → 200 no insert, dedup)
- [ ] T004 Accessibility pass on the form (FR-007) and a phone-width check (SC-004)
- [ ] T005 Resolve the open questions above and fold the answers back into this spec
