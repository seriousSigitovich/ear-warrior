# Feature Specification: Social Analytics Dashboard (YouTube + Instagram)

**Feature Branch**: `006-social-analytics` (not created — work landed on `master`)

**Created**: 2026-10-16 (**retroactive**: built before this spec; requirements are read from `server/src/social/`,
`server/src/routes/social.ts` and the commits `fea8436`, `10d5cd3`, `0d41b16`)

**Status**: Implemented — **YouTube verified live (2026-10-16), Instagram never run against the live API**; open questions below

**Input**: The author runs hook experiments on short videos (`docs/experiments.md`, H1–H14) and today reads each
platform's studio by hand, one screen at a time. They want one private page that shows the essence at a glance and the
details on demand, and that can later be tied to the experiments and to waitlist signups.

## Clarifications

### Session 2026-10-16 (recorded from the implementation — confirm or correct)

- Q: Which platforms? → A: **YouTube** and **Instagram** (Business account). **TikTok has no usable API** for a personal account, so it stays a manual read (see memory `analytics-access-chrome`) and is out of scope.
- Q: Build or buy? → A: **Own collector + own page** (chosen over Metricool/Looker Studio/Sheets) so the numbers live next to the app's own data and can be joined with experiments and signups later.
- Q: Why can't growth just be read from the platform? → A: Platforms report **cumulative** totals ("1 143 views"). A weekly figure is the difference between two daily snapshots, so it only exists from the day collection started; before that the page shows lifetime totals instead of inventing a number.
- Q: Which metric from the experiments log is unavailable? → A: YouTube Studio's **"viewed vs swiped away"** is not exposed by the Analytics API; it stays manual in `docs/experiments.md`.
- Q: Who may see the page? → A: Only the owner (single shared password). With no password configured the page does not exist.
- Q: How does the owner connect YouTube without handling secrets? → A: A one-time local helper (`npm run yt:auth`) runs the Google consent in the owner's browser and stores the resulting token itself; the owner never copies it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See how the channels are doing at a glance (Priority: P1)

As the author, I want one page that answers "what happened in the last week?" per platform, so that I stop opening three studios.

**Why this priority**: It is the whole reason the feature exists; everything else supports it.
**Independent Test**: With one platform connected and collected, open the page → a card shows that platform's views for the period, followers, best post and the top posts list, without opening any other screen.

**Acceptance Scenarios**:

1. **Given** snapshots exist at the start and end of a 7-day window, **When** the page opens, **Then** each platform card shows views gained in the window, the change against the previous 7 days and the follower change.
2. **Given** collection started less than a window ago, **When** the page opens, **Then** the card shows lifetime views and says when collection started, instead of a growth figure.
3. **Given** I switch to 28 or 90 days, **When** the page reloads, **Then** every figure recomputes for that window.
4. **Given** several posts grew, **When** the page opens, **Then** a "what worked" list shows the top posts by growth with a small trend line.

---

### User Story 2 - Trust that the numbers are current (Priority: P1)

As the author, I want to see when each platform was last collected and whether it failed, so that I never read stale numbers as fresh.

**Why this priority**: A dashboard that silently shows old data is worse than none.
**Independent Test**: Break one platform's credentials, run a collection → that platform shows a failure with a readable reason while the other platform's data and status are unaffected.

**Acceptance Scenarios**:

1. **Given** a successful run, **When** the page opens, **Then** the platform shows "updated N minutes/hours ago".
2. **Given** a platform's credentials are rejected, **When** the page opens, **Then** that platform shows a failed state with the platform's error message, and the other platform is unaffected.
3. **Given** a platform is not set up, **When** the page opens, **Then** it is marked "not connected" rather than empty or zero.
4. **Given** I press "refresh now", **When** a run started less than 2 minutes ago, **Then** no second run starts.

---

### User Story 3 - Drill into one post (Priority: P2)

As the author, I want every metric of a post and its views over time on demand, so that I can compare hook variants without leaving the page.

**Independent Test**: Expand a post → all metrics the platform reports for it, a views-over-time chart and a link to the original appear; collapsing hides them.

**Acceptance Scenarios**:

1. **Given** a post, **When** I expand it, **Then** only the metrics the platform actually reports are listed (no zero placeholders) and the original post is one click away.
2. **Given** posts of both platforms, **When** I sort by growth, views or date, or filter by platform, **Then** the list reorders/filters, with posts of unknown growth placed last.
3. **Given** a post carries an experiment number in its title or caption, **When** it is listed, **Then** the number is shown with the title.

---

### User Story 4 - Connect a platform once and forget it (Priority: P2)

As the author, I want to connect YouTube and Instagram once and have collection keep working, so that the page does not need maintenance.

**Independent Test**: Follow the setup steps for YouTube from a clean state → a collection returns the channel's posts with no manual token handling afterwards.

**Acceptance Scenarios**:

1. **Given** a clean setup, **When** I run the one-time authorization and complete the consent in my browser, **Then** the credential is stored without my copying it anywhere.
2. **Given** Instagram's long-lived token is close to expiry, **When** a collection runs, **Then** it is renewed and the new value is kept for the next run.
3. **Given** collection is scheduled, **When** a day passes, **Then** a new daily snapshot exists per post without my action.

---

### User Story 5 - Keep it private and safe (Priority: P3)

As the author, I want the page to be reachable only by me and safe against hostile text in post titles, so that exposing it costs nothing.

**Independent Test**: Request the page without credentials, with wrong credentials, and with no password configured; render a post whose title contains markup.

**Acceptance Scenarios**:

1. **Given** no password is configured, **When** the page is requested, **Then** it responds as if it does not exist.
2. **Given** a password is configured, **When** it is requested without or with wrong credentials, **Then** access is refused.
3. **Given** a post title or an error message contains markup, **When** the page renders, **Then** it is shown as text and executes nothing.
4. **Given** any failure, **When** its message is stored or shown, **Then** it contains no access token, secret or password.

### Edge Cases

- A post published inside the window counts from zero for that window.
- A platform counter that goes down (corrections) never shows negative growth.
- A metric the platform does not report (e.g. saves on YouTube) stays empty — not 0.
- One platform's secondary data source fails (YouTube watch-time analytics lagging ~2 days): the public counters are still stored, only the missing columns stay empty.
- One metric is rejected for one post (Instagram): the post keeps the metrics that were accepted.
- Collection runs twice on the same day: the day's snapshot is overwritten, not duplicated.
- A post is deleted on the platform: its history stays and it is no longer updated *(as built — see Open Questions)*.
- Day boundaries are UTC, so "today" can differ from the owner's local date for a few hours.
- A title is very long or empty: it is truncated/replaced by a placeholder in the list.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST collect, for every post on each connected platform, the metrics that platform provides among: views, likes, comments, shares, saves, reach, average watch time, average watch percentage, follows gained from the post, profile visits from the post.
- **FR-002**: The system MUST collect account-level figures: followers on both platforms; on Instagram also profile views, link taps and reach over the last 28 days.
- **FR-003**: The system MUST keep one snapshot per post per UTC day; a second collection on the same day replaces that day's values.
- **FR-004**: A metric a platform does not report MUST be stored and shown as unknown, never as zero.
- **FR-005**: Growth over a window MUST equal the difference between the snapshot at the window's end and at its start. It MUST be unknown when no start snapshot exists, except for posts published inside the window (which count from zero). A platform total MUST be unknown if any of its posts is unknown. An unknown figure MUST never be displayed as a number.
- **FR-006**: The page MUST default to a 7-day window and offer 7, 28 and 90 days; the change against the previous equal window MUST be shown only when both windows are known.
- **FR-007**: Each platform MUST be collected independently; a failure MUST be recorded with a human-readable reason and shown on the page; stale data MUST NOT be presented without its age.
- **FR-008**: The owner MUST be able to trigger a collection from the page, limited to one run per 2 minutes, and collection MUST also be schedulable without the page.
- **FR-009**: The page MUST show per-platform essence first (period views and change, followers and change, best post, top posts) and per-post detail on demand (all reported metrics, views-over-time chart, link to the original), sortable by growth, views or date and filterable by platform.
- **FR-010**: When a post's title or caption carries an experiment number ("#N"), the system MUST extract and display it; hashtags without a number MUST NOT match.
- **FR-011**: The page MUST require authentication, MUST NOT exist when no password is configured, and MUST NOT be indexable by search engines.
- **FR-012**: All text originating from a platform (titles, captions, error messages) MUST be escaped on output.
- **FR-013**: Credentials MUST come only from configuration or the credential store; they MUST NOT appear in logs, stored errors, pages or version control. A renewed Instagram token MUST be persisted.
- **FR-014**: Platform access MUST be read-only. YouTube authorization MUST be performable without the owner copying any secret or token.
- **FR-015**: The page MUST be usable at phone width without horizontal scrolling.
- **FR-016**: The public site MUST provide a home page and a privacy policy that discloses own-account analytics reading, because the platform's consent screen requires them (dependency: feature 003's landing).

### Key Entities

- **Post**: one published video/reel — platform, external id, title, link, kind, duration, publish date, optional experiment number.
- **Snapshot**: a post's cumulative metrics on one UTC day; unknown values are absent.
- **Account snapshot**: followers and platform-specific account figures on one UTC day.
- **Collection run**: when a platform was collected, whether it succeeded, how many posts, and the error if not.
- **Credential**: a rotating token (Instagram) kept between runs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The owner reads each connected platform's weekly headline (views, followers, best post) from one page in under 10 seconds, with no studio visit.
- **SC-002**: 100 % of the posts a connected platform returns appear on the page, with their latest snapshot.
- **SC-003**: 0 cases in which unmeasurable growth is shown as a number (verified by tests on the window rules).
- **SC-004**: One platform failing never hides the other platform's data, and the failure is visible on the next page view.
- **SC-005**: After one full window of daily collection, window growth is known for 100 % of posts that existed at the window start.
- **SC-006**: 0 credentials appear in any page, stored error or log line (verified by tests that feed secrets through failing requests).
- **SC-007**: Connecting YouTube needs one consent click-through and no pasted secrets after the one-time client setup.

## Assumptions

- A single owner uses the page; one shared password is sufficient.
- Instagram is a Business/Creator account; both platforms' APIs are available at no cost for reading own data.
- Volume is small (hundreds of posts × at most 90 days of snapshots), so no pagination or caching is needed.
- Platforms' own data lags (YouTube watch-behaviour ~2 days); numbers are "as of the last collection", not real time.
- The page lives on the existing Ear Warrior server and database.

## Open Questions (not decided — owner to resolve)

- **Who runs the daily collection?** Snapshots exist only while the collector runs. As of 2026-10-16 the server runs only on the author's machine (Docker Postgres); no production host is recorded. Without a continuously running host the history has gaps and growth stays unknown. Pick a host (or a scheduler) before relying on trends.
- **Tie posts to hypotheses.** The experiment number is only parsed from titles; most existing titles carry none. Should posts be mapped to `docs/experiments.md` rows (H-ids / video numbers) by hand, by a rule, or by editing titles?
- **Join with the waitlist.** Signup `source` tags (`youtube:ear16`) are not yet shown next to views, so conversion per video is still computed by hand.
- **Deleted posts and retention.** Deleted posts keep their history forever and snapshots are never pruned. Acceptable at this volume?
- **TikTok.** Manual import (CSV/paste) or stay out?
- **Instagram is unverified live.** Needs a Meta app and token; the collector was only exercised against recorded response shapes.

## Verification status

- **Automated**: 22 tests (`npm test` in `server/`): window/growth rules and sorting, both collectors against scripted API responses (including rejected metrics, failing analytics, token refresh, no secret in errors), page escaping, the authorization helpers.
- **Live**: YouTube collected 27 posts, 9 516 views, 7 subscribers on 2026-10-16 and rendered on the page. The page's look was checked on synthetic data on desktop and phone widths.
- **Not verified**: Instagram live; scheduled collection over several days; accessibility of the page (contrast/keyboard) beyond the native `<details>` controls.
- **Constitution**: tests were written alongside, not before, the implementation (II); the server has no linter configured (I); performance targets were not declared (IV) — recorded in `plan.md` and `tasks.md`.
