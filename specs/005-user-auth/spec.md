# Feature Specification: Optional Email Sign-In

**Feature Branch**: `005-user-auth` (created 2026-10-21 from `master`, per T086: one branch per feature)

**Created**: 2026-10-19

**Status**: Implemented and deployed 2026-10-21 (server + app + web). Open: p95 measurement, TalkBack on a real phone, Play Data Safety, product events — see tasks.md

**Input**: Ear Warrior goes into a closed Android beta with 14 people from the waitlist. The owner needs to know *who is who* in the usage and crash data, and wants a real (not self-declared) identity. Sign-in must never get in the way of practising: the app works fully without it. Google sign-in is out of scope for now.

## Clarifications

### Session 2026-10-19

- Q: Which sign-in methods? → A: **Email one-time code only.** No passwords, no Google, no other providers (Google is a later, separate piece).
- Q: Required or optional? → A: **Optional.** The learner can skip sign-in and use every feature anonymously, exactly as today (the per-install anonymous device id of spec 001 FR-019 stays).
- Q: What is the reason to sign in during the beta? → A: So the owner can tell testers apart, follow up with them personally, and tie usage and crash reports to a person who has agreed to it.
- Q: Does this supersede an earlier decision? → A: Yes. The 2026-10-11 decision "Google + email, optional" is narrowed to "email code, optional". It also amends spec 001 FR-019 / SC-008 and spec 002 ("there are no accounts"): an account now **may** exist, and when it does, email is personal data that the privacy policy must cover.
- Q: Should signing in on a fresh install bring back earlier progress? → A: **No, not for now (option B).** The account only identifies the person; each install keeps its own history, as today. Restoring progress on a new install is a later spec, most naturally together with Google sign-in.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in with an emailed code (Priority: P1)

A beta tester opens the app, chooses to sign in, types their email, receives a 6-digit code by email, types it, and is signed in. Next time they open the app they are still signed in.

**Why this priority**: it is the whole reason for the feature — a verified, person-level identity for the beta.

**Independent Test**: With a real mailbox, request a code, enter it, confirm the app shows the signed-in email, force-close and reopen the app, confirm it is still signed in.

**Acceptance Scenarios**:

1. **Given** a signed-out learner, **When** they enter a valid email and ask for a code, **Then** a code arrives at that address and the app asks for it.
2. **Given** a code was sent, **When** the learner enters it correctly within its lifetime, **Then** they are signed in and see which email they are signed in as.
3. **Given** a signed-in learner, **When** they close and reopen the app (including after restarting the phone), **Then** they are still signed in.
4. **Given** a brand-new email, **When** the code is entered correctly, **Then** an account is created automatically (no separate sign-up step); **Given** a returning email, **Then** the same flow signs them back in.
5. **Given** the learner mistyped the email, **When** they go back, **Then** they can correct it and request a new code without restarting the app.

---

### User Story 2 - Skip sign-in and practise anonymously (Priority: P1)

A learner who does not want to give an email can dismiss the sign-in offer with one tap and uses every feature of the app, the same as today. They can come back to sign-in later from Settings.

**Why this priority**: optional sign-in is the product rule; breaking the anonymous path would hurt every tester and would fail the Play review's access check.

**Independent Test**: Fresh install, skip sign-in, complete a full practice cycle and view progress; nothing is locked or degraded.

**Acceptance Scenarios**:

1. **Given** a first launch, **When** the sign-in offer appears, **Then** a clearly visible "Skip" is available and one tap goes straight on.
2. **Given** a learner who skipped, **When** they use practice, progress and settings, **Then** nothing requires an account.
3. **Given** a learner who skipped, **When** they open Settings, **Then** they can start sign-in from there at any time.
4. **Given** no network, **When** the learner practises, **Then** the loop works exactly as before; only the sign-in action reports it needs a connection.

---

### User Story 3 - Know who a session or a crash belongs to (Priority: P2)

For a learner who signed in, the owner can see their email next to their usage events and next to their crash reports, including events recorded on the same device before they signed in. For a learner who did not sign in, data stays anonymous.

**Why this priority**: this is the payoff for the owner, but it depends on User Story 1.

**Independent Test**: Sign in on a test phone, run a session, force a test crash; the owner's usage view and crash tool both show the test email. Sign out, run another session; the new events are anonymous.

**Acceptance Scenarios**:

1. **Given** a learner signs in, **When** they practise, **Then** each new usage event and each crash report carries their email.
2. **Given** the same device recorded events before sign-in, **When** the learner signs in, **Then** those earlier events from that device are attributable to the account as well.
3. **Given** a learner signs out, **When** they practise, **Then** new events and crash reports carry no email (only the anonymous device id).

---

### User Story 4 - Sign out (Priority: P2)

A signed-in learner can sign out from Settings. After that the app behaves as a first-time anonymous user, and their account remains so they can sign in again later.

**Why this priority**: a normal expectation of any sign-in, and needed before shared devices are plausible.

**Independent Test**: Sign in, sign out, confirm Settings offers sign-in again and the app no longer shows the email.

**Acceptance Scenarios**:

1. **Given** a signed-in learner, **When** they choose sign out and confirm, **Then** the app shows the signed-out state and no longer sends their email anywhere.
2. **Given** a learner who signed out, **When** they sign in again with the same email, **Then** it is the same account.

---

### User Story 5 - Delete my account and data (Priority: P2)

A signed-in learner can delete their account from inside the app, with a clear confirmation. A person who no longer has the app can ask for deletion through a public page on the website. Deletion removes the email and every link between that person and their data.

**Why this priority**: required by Google Play for any app that creates accounts, and by the privacy promise to testers.

**Independent Test**: Create an account, practise, delete it in the app, then confirm the email is gone from the account store, from usage events and from the crash tool's user field.

**Acceptance Scenarios**:

1. **Given** a signed-in learner, **When** they choose "Delete account" and confirm, **Then** the account and the email are removed and the app returns to the anonymous state.
2. **Given** a deleted account, **When** the same email asks for a code later, **Then** a brand-new account with no history is created.
3. **Given** a person without the app, **When** they use the deletion request page on the website with their email, **Then** the request is accepted and completed within the time stated on the privacy page.
4. **Given** the confirmation dialog, **When** the learner cancels, **Then** nothing is deleted.

---

### User Story 6 - Reviewer test account for Google Play (Priority: P3)

The owner can switch on a fixed test account (one known email with one known code) so that a Play reviewer, who cannot read a real inbox, can sign in during the store review. It is off unless explicitly switched on.

**Why this priority**: sign-in is optional, so the reviewer can normally skip it; the account only matters if the store asks for credentials or if sign-in is ever made mandatory.

**Independent Test**: With the test account switched on, sign in using the fixed email and code with no email delivered; with it switched off, the same email and code are refused.

**Acceptance Scenarios**:

1. **Given** the test account is enabled, **When** the fixed email and fixed code are entered, **Then** the learner is signed in without any message being sent.
2. **Given** the test account is disabled, **When** the same values are entered, **Then** sign-in is refused like any wrong code.
3. **Given** the test account is enabled, **When** any other email asks for a code, **Then** the normal flow applies and the fixed code does not work for it.

---

### Edge Cases

- Email with capital letters or surrounding spaces is treated as the same address as its tidy form.
- Obviously invalid email text is rejected on the screen before anything is sent.
- The code expires: entering it afterwards says it has expired and offers to send a new one.
- Wrong code: the learner is told it is wrong and how many attempts remain; after 5 wrong attempts that code is dead and a new one is needed.
- Asking for a new code makes every earlier code for that email invalid.
- A code works once; reusing it is refused.
- Someone tries to request codes for an address in bulk: requests are limited per address and per source, and the learner sees an actionable "try again in N minutes".
- The response to "send me a code" is the same whether or not the email already has an account (no way to discover who is registered).
- The email does not arrive: the screen offers "Send again" after a short wait and tells the learner to check spam.
- The network drops between requesting and entering the code: the code stays valid and entry can resume once the connection returns.
- The app is closed with a code pending: on reopening, the learner can ask for a new one or re-enter the pending code while valid.
- Two people sign in on the same phone one after the other: each sign-in is attributed to whoever is signed in at that time; sign-out stops attribution.
- The same email signs in on two phones: both are signed in to the one account.
- Account deleted on one phone while signed in on another: the other phone is signed out the next time it contacts the service.
- The server is down or slow: sign-in actions fail with an actionable message; practice is unaffected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST offer sign-in by email one-time code and MUST NOT require a password.
- **FR-002**: Sign-in MUST be optional: every existing feature (practice, progress, settings, offline use) MUST work for a learner who never signs in, with no gated content.
- **FR-003**: The sign-in offer MUST be shown once, when the Home screen first opens, with a one-tap "Skip", and MUST be reachable again from Settings at any time.
- **FR-004**: The system MUST treat an email as the same address regardless of letter case or surrounding spaces, and MUST reject malformed addresses before sending anything.
- **FR-005**: A code MUST be 6 digits, valid for 10 minutes, usable once, and replaced by any newer code requested for the same email.
- **FR-006**: A code MUST stop being accepted after 5 wrong attempts; the learner MUST be told how many attempts remain and that a new code is needed once they run out.
- **FR-007**: Requesting a code MUST be rate-limited per email address (at most 5 requests per hour) and per source (at most 20 per hour), and a resend MUST not be possible within 60 seconds of the previous one. A refused request MUST tell the learner when to try again.
- **FR-008**: The answer to a code request MUST NOT reveal whether the email already has an account.
- **FR-009**: A correct code MUST sign the learner in; if the email has no account, one MUST be created in the same step (there is no separate sign-up).
- **FR-010**: A signed-in state MUST persist across app restarts and phone restarts until the learner signs out or the account is deleted.
- **FR-011**: Signing in MUST link the current device to the account. From then on, usage events and crash reports from that device MUST carry the account's email, and events from that device recorded before sign-in MUST be attributable to the account.
- **FR-012**: Signing out MUST end the link: events and crash reports recorded afterwards MUST carry only the anonymous device id.
- **FR-013**: A signed-in learner MUST be able to sign out from Settings.
- **FR-014**: A signed-in learner MUST be able to delete their account from Settings, after an explicit confirmation that states what will be removed.
- **FR-015**: Deleting an account MUST remove the email, the account record, the device links, and the email attribution on usage events and crash reports. Anonymous data tied only to a device id MAY remain.
- **FR-016**: A public web page MUST let a person request account deletion by email without having the app; the request and its completion time MUST be described on the privacy page.
- **FR-017**: The owner MUST be able to enable and disable a fixed reviewer test account (one email, one code) without releasing a new app version; when disabled it MUST behave like any invalid code, and when enabled it MUST NOT cause any message to be sent or affect any other address.
- **FR-018**: Sign-in actions that need the network MUST fail with an actionable message when offline or when the service is unavailable, and MUST NOT affect practice.
- **FR-019**: Every error on the sign-in screens MUST state what happened and what the learner can do next, in plain language (Constitution III).
- **FR-020**: Sign-in, code entry, skip, sign-out and delete controls MUST carry accessible labels, meet the project's contrast and touch-target baseline, and keep their layout at the largest OS font size (spec 004).
- **FR-021**: The privacy policy page and the store data-safety declaration MUST describe the email, the account identifier, the sign-in method and the deletion route before the first build that contains sign-in is submitted.
- **FR-022**: The 6-digit code and the session credential MUST NOT appear in logs, usage events or crash reports.
- **FR-023**: Existing behaviour that sends anonymous attempt data (spec 001 FR-019, spec 002) MUST be unchanged for a learner who is signed out.

### Key Entities

- **Account**: one person, identified by a verified email; has a creation date; can be deleted.
- **Sign-in code**: a short-lived, single-use 6-digit value bound to one email; tracks when it was requested, expires, and how many wrong attempts were made.
- **Device link**: the association between one install's anonymous device id and an account; created at sign-in, removed at sign-out or deletion.
- **Signed-in session**: the credential a device holds while signed in; ends at sign-out, deletion or revocation.
- **Reviewer test account**: an owner-controlled, switchable fixed email and code for store review; not an ordinary account type.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 10 of the 14 beta testers are identifiable by a verified email within 7 days of receiving the build.
- **SC-002**: 95% of testers who start sign-in finish it on the first attempt, and the whole flow takes under 90 seconds of the learner's own time (excluding waiting for the email).
- **SC-003**: 95% of code emails arrive within 60 seconds of the request.
- **SC-004**: After a correct code, the learner sees themselves signed in within 2 seconds on a normal mobile connection.
- **SC-005**: A learner can skip sign-in with a single tap, and 100% of existing features work without an account (verified by a full practice cycle from a fresh install).
- **SC-006**: Over a test session, 100% of usage events and crash reports after sign-in carry the account's email, and 0% after sign-out.
- **SC-007**: Under abuse tests, a 6th wrong attempt on one code is never accepted, a used or expired code is never accepted, and a 6th code request for one address within an hour is refused.
- **SC-008**: After an account deletion completes, the email cannot be found in the account store, in usage events or in the crash tool's user field; in-app deletion takes effect immediately and a website request is completed within 7 days.
- **SC-009**: A Play reviewer can sign in with the test account in under 2 minutes without access to a real inbox, and the same values fail when the test account is switched off.

## Assumptions

- The owner knows each of the 14 testers personally, so a verified email is enough identity; no names, avatars or profile fields are collected.
- Sign-in is for the Android beta first; the iOS build is not part of this scope.
- Codes are delivered by email from an existing mailbox-based sender during the beta; a dedicated transactional email provider is chosen before the public release and does not change this spec.
- Beta traffic is tiny (about 14 people), so the abuse limits in FR-007 are set for safety, not capacity.
- Account data, usage events and crash data stay with the project's existing backend and crash tool; no new data processor beyond what the crash tool (decided 2026-10-19) already adds.
- The signed-in state lasts until sign-out or deletion; there is no expiry prompt during the beta.
- Out of scope: Google or any other provider sign-in, passwords, profile editing, mandatory sign-in, changing the email on an account, and restoring progress on a new install (decided 2026-10-19: later, with Google sign-in).
- Dependencies: spec 001 FR-019 / SC-008 and spec 002 ("no accounts") need an amendment note pointing here; the Home screen hosts the first sign-in offer (there is no separate onboarding screen); the product-events work reads the account email from this feature.
