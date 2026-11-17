# Feature Specification: Server-Authoritative XP, Ranks and Melody Library

**Feature Branch**: `024-server-authoritative-xp`

**Created**: 2026-11-16

**Status**: Implemented (server and app) — not yet verified on a device or deployed; see tasks.md

**Input**: Owner (2026-11-16): "The rank system works strangely. I expect only XP to raise the rank, with no extra conditions, but it must not be possible to cheat or farm levels easily. The server computes XP; the client is dumb and only displays data. Melodies live on the server so we can manage them; they are stored already voiced and the client downloads and caches them as needed. XP for melodies of different levels differs proportionally; the top levels must be hard to reach without completing hard melodies. Mastery is removed."

Amends [spec 013](../013-gamification/spec.md) (XP, ranks, mastery, challenges), [spec 019](../019-progress-sync/spec.md) (the device no longer sends rewards) and specs 018/020 (daily challenges are computed from accepted phrases).

## Context

Today the device decides everything: it grades a phrase, pays XP, records mastery and derives the rank, then pushes those rows to the server (spec 019). A rank needs both XP and mastery of levels (ten melodies, a recent average, hint-free runs), so a learner with enough XP can sit on a lower rank for reasons the screen explains poorly. Because the device is trusted, XP can be forged, and because every phrase pays the same on any level, the ranks can be earned on the easiest melodies. The melody library (100 tunes, their answers and their audio clips) ships inside the app, so adding or fixing a melody needs a release.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - XP alone sets the rank, and it is hard to cheat (Priority: P1)

A learner plays a phrase and answers it. The result — XP earned, total XP, rank, whether the rank rose — comes back already computed, and the screen only shows it. Rank is a plain function of total XP: more XP, higher rank, nothing else to unlock. Harder melodies pay proportionally more, and the XP of easy levels is limited, so the top ranks cannot be reached without completing hard melodies.

**Why this priority**: it is the owner's request and the core of the change; every other story serves it.

**Independent Test**: play phrases on the same account and watch XP and rank move; try repeated, guessed and hinted answers and confirm none pays more than a clean first answer.

**Acceptance Scenarios**:

1. **Given** a learner who passes a phrase on the first attempt with no hints, **When** the result arrives, **Then** XP = base (10, +5 at ≥90% notes landed, +5 at 100%) × the level multiplier, and total XP rises by that amount.
2. **Given** phrases of level 1 and level 9 passed identically, **When** XP is paid, **Then** the level-9 phrase pays 15 times the level-1 phrase.
3. **Given** a phrase passed on the second attempt, **When** it is paid, **Then** it pays 50% of the first-attempt amount; on the third or later attempt it pays 0 XP but the phrase still counts as passed.
4. **Given** the first-note hint was used, **When** the phrase is paid, **Then** XP is halved; **Given** the answer was shown, **Then** it pays 0.
5. **Given** a phrase already paid, **When** it is played again, **Then** it pays 0 XP, forever.
6. **Given** a learner who has earned the daily cap of XP, **When** they pass more phrases that day, **Then** each pays half until the next local day.
7. **Given** any total XP, **When** the rank is shown, **Then** it is the highest rank whose XP threshold is met — no other condition — and no mastery of levels is shown or required anywhere.
8. **Given** the rank thresholds, **When** all phrases of the easy levels are passed at full value, **Then** the total still falls short of the top ranks, so they need hard melodies.
9. **Given** a request that claims XP, a rank or a completed phrase without a matching phrase check, **When** the server receives it, **Then** it is refused and changes nothing.

---

### User Story 2 - The server owns the melody library (Priority: P1)

The owner adds, edits, re-levels or removes a melody on the server — title, level, tempo, phrases, answer notes, source and the voiced audio — and every device sees the change without an app release. The catalog the device receives never contains the answer notes.

**Why this priority**: the server can only grade phrases it holds the answers to, so this is a prerequisite of Story 1.

**Independent Test**: add a melody through the admin page and confirm it appears in the app catalog (without notes) and is playable and gradable.

**Acceptance Scenarios**:

1. **Given** the 100 current melodies, **When** the server is set up, **Then** all of them are on the server with their level, tempo, phrases, source, answer and audio, and are equal to today's.
2. **Given** the admin page, **When** the owner adds or changes a melody, **Then** the catalog served to devices changes accordingly.
3. **Given** the catalog request, **When** the response is read, **Then** it holds no answer notes.
4. **Given** a melody removed or re-levelled, **When** a device refreshes, **Then** the catalog reflects it and phrases already paid stay paid.

---

### User Story 3 - Audio is downloaded and cached on the device (Priority: P2)

The learner plays a melody; its voiced audio is downloaded once and kept. The current level and the next one are fetched ahead in the background, so a melody starts without a wait. A clip is downloaded again only when its audio changed. A few level-1 clips ship in the app so the very first launch works without a network.

**Why this priority**: removes the audio from the app bundle and from the release cycle; the XP rules do not depend on it.

**Independent Test**: airplane mode on a fresh install plays a bundled level-1 melody; online, a melody downloads once and plays from the cache the second time; changing the audio on the server makes the device fetch it again.

**Acceptance Scenarios**:

1. **Given** a fresh install with no network, **When** the learner opens level 1, **Then** the bundled melodies play; other melodies say they need a connection once and why.
2. **Given** a cached clip, **When** the melody is played again, **Then** no download happens.
3. **Given** the owner replaced a clip, **When** the device next refreshes the catalog, **Then** the clip is downloaded again and the old one is dropped.
4. **Given** the learner is on level N, **When** the app is idle online, **Then** levels N and N+1 are downloaded in the background without blocking any screen.
5. **Given** a melody removed from the catalog, **When** the device refreshes, **Then** its cached clip is deleted.

---

### User Story 4 - Offline play and migration of existing XP (Priority: P2)

Without a network the learner can still play and answer; their checks wait and are sent later, and the XP they will earn shows as "pending" until the server answers. Existing learners keep their place: their XP is recomputed from their stored attempts under the new rules, once, and the rank follows from it.

**Why this priority**: it keeps existing users and offline play intact, but the core rules work without it.

**Independent Test**: answer phrases offline, reconnect, and see pending XP replaced by the real amounts; run the recompute on a user with history and check their total.

**Acceptance Scenarios**:

1. **Given** no network, **When** a phrase is checked, **Then** the check is queued, the screen shows the result as pending, and nothing is lost if the app is closed.
2. **Given** queued checks and a returning network, **When** they are sent in the order made, **Then** each is paid as if it had been checked online (attempt number, hints, daily cap by the local day it was made).
3. **Given** a learner with stored attempts and old XP, **When** the recompute runs, **Then** their total XP and rank equal what the new rules give for that history, shown to them once with a short explanation if the rank changed.
4. **Given** the recompute ran, **When** it is run again, **Then** nothing changes.

---

### User Story 5 - Daily challenges and streak follow accepted phrases (Priority: P3)

The day's challenges and the streak are counted from the phrases the server accepted, not from rows the device sends.

**Why this priority**: keeps the existing daily-goal features consistent with the new authority; no new behaviour for the learner.

**Independent Test**: pass phrases and watch challenge progress and streak change from the server's answer only.

**Acceptance Scenarios**:

1. **Given** the day's challenges, **When** phrases are accepted, **Then** their progress, rewards and the "all done" bonus come from the server and are paid once.
2. **Given** a day with an accepted phrase, **When** the streak is read, **Then** that day counts.

### Edge Cases

- Two devices of one account check the same phrase: the server pays it once; the second answer arrives as already paid.
- A queued check arrives after the melody was removed or its phrases changed: it is rejected cleanly, the device drops it and shows no error to the learner.
- Playing a phrase with several attempts quickly (guessing): later attempts pay less or nothing, as in the rules; XP never goes negative.
- The daily cap counts by the learner's local day at the time of the check, not the time it was sent.
- A phrase paid at a lower amount (second attempt) is not paid again for a better later attempt.
- The learner is not signed in: the device gets an anonymous server identity on first launch, its XP is kept on the server under it, and it is merged into the account at sign-in (XP and paid phrases are united; a phrase paid on both counts once). Playing never requires sign-in (owner, 2026-11-16).
- A clip download fails or is cut off: the melody is not marked as cached and the next attempt retries.
- A melody has no audio yet on the server: it is not offered to learners.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The server MUST hold the melody library: id, title, level (1–9), tempo, phrases, answer notes, source and voiced audio with a content fingerprint.
- **FR-002**: The server MUST give devices a catalog of melodies that includes no answer notes, except for the tunes of levels 1–2 (amended 2026-11-16, owner: a new learner must be able to play at once, offline): their answer ships in the app and in the catalog, the app grades them itself for instant feedback, and the server still re-grades every check, so XP stays the server's. The levels 1–2 can pay at most 1 800 XP in all, below the rank where it would matter (SC-002).
- **FR-003**: The owner MUST be able to add, change, re-level, hide and remove melodies and replace their audio from an admin page protected like the other admin pages.
- **FR-004**: A device MUST download a melody's audio on demand, cache it, fetch the current and next level ahead in the background, and download again only when the fingerprint changed; cached clips of melodies no longer in the catalog MUST be deleted.
- **FR-005**: Every tune of levels 1–2, with its clip and its answer, MUST ship in the app so the first launch works offline and a new learner plays at once (amended 2026-11-16; about 22 tunes, 6 MB).
- **FR-006**: On each phrase check the device MUST send only raw input (melody, phrase, the notes played); the server MUST grade it against the stored answer and compute accuracy, XP and rank. Hints and "show answer" are obtained from the server, which records them itself, so a device cannot claim to have used none.
- **FR-007**: The server MUST answer a phrase check with the XP earned and its breakdown, total XP, rank, whether the rank rose, and streak; the device MUST show these and MUST NOT compute any of them.
- **FR-008**: A phrase counts as passed from 80% of notes landed. XP per phrase = (10, +5 at ≥90%, +5 at 100%) × the level multiplier × the attempt factor × the hint factor, then the daily cap rule.
- **FR-009**: The level multiplier is proportional to difficulty and grows faster than linearly: levels 1–9 = 1, 1.5, 2, 3, 4, 6, 8, 11, 15.
- **FR-010**: The attempt factor is 100% for the first passing attempt, 50% for the second, and 0% from the third on; a phrase passed at 0% still counts as passed. The first-note hint multiplies by 0.5; showing the answer pays 0.
- **FR-011**: A phrase MUST pay at most once per account, ever, regardless of device or later better attempts.
- **FR-012**: After the daily cap in a local day, further XP that day MUST be halved. The cap counts XP before the level multiplier, so it limits how much is practised, not how hard.
- **FR-013**: Rank MUST be the highest rank whose XP threshold is met, with no other condition; level mastery MUST be removed from rules, storage, screens and copy.
- **FR-014**: Rank thresholds MUST be set from the library's per-level XP potential so that the top ranks cannot be reached without passing phrases of the hard levels; the proposed numbers MUST be shown to the owner for approval before they ship.
- **FR-015**: The server MUST reject any attempt by a device to submit XP, rank, mastery or completion rows; the old endpoint that accepted them MUST be disabled once the new app version is out.
- **FR-016**: Without a network the device MUST queue phrase checks durably, show the result as pending, and send them in order when it can; each queued check MUST be graded with the attempt number and local day it was made.
- **FR-017**: Existing accounts' XP MUST be recomputed once from their stored attempts under the new rules; running it again MUST change nothing.
- **FR-018**: Daily challenges, their rewards, the "all done" bonus and the streak MUST be computed on the server from accepted phrases and paid once.
- **FR-019**: All numbers of the reward rules (base, bonuses, multipliers, attempt and hint factors, daily cap, thresholds, pass mark) MUST live in one server configuration.
- **FR-020**: A rank-up MUST still show the celebratory modal once; the rank screens MUST show XP to the next rank only.
- **FR-021**: A device without an account MUST get an anonymous server identity on first launch and earn XP under it; at sign-in its ledger MUST be merged into the account, each phrase counting once.

### Key Entities

- **Tune**: a library melody — level, tempo, phrases, answer notes (server only), source, audio and its fingerprint, visibility.
- **Phrase check**: one answer to one phrase — account, tune, phrase, notes played, hints, answer-shown flag, the local day and time, the attempt number, the grade and the XP it paid.
- **XP ledger**: the append-only list of what each phrase, challenge and bonus paid; total XP is its sum.
- **Rank**: a named step with an XP threshold; the learner's rank is derived from total XP.
- **Cached clip**: a device-side copy of a tune's audio with the fingerprint it was downloaded at.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A forged or replayed request can never raise XP or rank: every XP change traces to a phrase check the server graded, and replaying the same check changes nothing.
- **SC-002**: Passing every phrase of levels 1–5 at full value is not enough XP for the top two ranks.
- **SC-003**: Guessing (three or more attempts on a phrase) earns at most half the XP of answering it cleanly, and a phrase never pays twice.
- **SC-004**: A melody added by the owner is playable by learners within one catalog refresh, with no app release.
- **SC-005**: A cached melody starts playing with no network wait; a melody on the current level starts without a visible wait for 95% of plays on a normal mobile connection.
- **SC-006**: The first launch with no network can play every tune of levels 1–2, graded on the device.
- **SC-007**: The app bundle shrinks by the clips of levels 3–9 moved to the server (about 21 MB: 6 MB of the 27 MB stay).
- **SC-008**: Every existing learner's total XP after the recompute equals what the new rules give for their stored attempts, and a second recompute changes nothing.
- **SC-009**: A learner sees their rank explained in one number — XP to the next rank — with no mention of mastery.

## Assumptions

- The daily cap is 300 base XP per local day (about 20 phrases, 4–5 tunes), counted before the level multiplier; the owner may change it in the configuration. The attempt counter is per phrase, counted from the first check of that phrase.
- Rank names and count (seven) stay; only thresholds change, to be derived from the library and approved by the owner.
- A phrase that was passed once is fully paid or lost: a lower-paid second-attempt pass is not topped up later.
- Offline answers pay by the rules as of the moment they were checked on the device; the server trusts only the raw input and the claimed local day within a sane window (a day cannot be in the future).
- The existing sign-in (spec 005/022) is reused; the server keeps one ledger per account.
- Audio clips continue to be rendered offline (nylon guitar samples) and uploaded to the server by a script or the admin page; the server does not render.
- Out of scope: leaderboards, friends, seasons, shops, changing the visual design of the rank screens beyond removing mastery, and automatic re-grading of old attempts for any other purpose.
