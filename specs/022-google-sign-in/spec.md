# Feature Specification: Optional Google Sign-In

**Feature Branch**: `022-google-sign-in` (created 2026-11-15 from `master`, per T086: one branch per feature)

**Created**: 2026-11-15

**Status**: Draft

**Input**: Owner (2026-11-15): "нужно добавить авторизацию через гугл, сделай согласно sdd". Spec 005 shipped email-code sign-in and
explicitly left Google as "a later, separate piece". Beta testers already hold Google accounts (they were recruited through Google
Play's closed track), so "Continue with Google" removes the inbox round-trip.

## Clarifications

### Session 2026-11-15

- Q: Does Google replace the email code? → A: **No, it is a second method.** Both stay available; the sign-in screen offers either. Spec 005's narrowing ("email code, optional") is widened back to "Google + email, optional" — the original 2026-10-11 decision.
- Q: Required or optional? → A: **Optional**, exactly as spec 005 (FR-002, FR-003): the app works fully without an account, the offer has a one-tap Skip.
- Q: What if a learner signs in with Google using an address that already has an email-code account? → A: **Same account.** Identity is the verified email; both methods prove ownership of it, so they open one account with one history. Nothing is merged or duplicated.
- Q: Does Google sign-in bring back progress on a fresh install? → A: **Yes, for free**: spec 019 already restores rank, XP, mastery and history for any signed-in account. This spec adds no restore logic of its own.
- Q: Which platforms? → A: **Android first** (the release target, as in spec 005 and 004). iOS is not part of this scope; before any iOS release that offers Google sign-in, the store's rule for also offering the platform's own sign-in must be checked (see Assumptions).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in with Google (Priority: P1)

A learner opens the sign-in screen, taps "Continue with Google", picks one of the Google accounts on their phone, and is signed in —
no email, no code. Next time they open the app they are still signed in.

**Why this priority**: it is the whole feature: the fastest identity path for the owner's testers, who all have Google accounts.

**Independent Test**: On a phone with a Google account, tap "Continue with Google", pick the account, confirm the app shows the signed-in
email, force-close and reopen the app, confirm it is still signed in.

**Acceptance Scenarios**:

1. **Given** a signed-out learner, **When** they tap "Continue with Google" and choose an account, **Then** they are signed in and see which email they are signed in as.
2. **Given** a signed-in learner, **When** they close and reopen the app (including after restarting the phone), **Then** they are still signed in.
3. **Given** a Google account that has never been used here, **When** sign-in completes, **Then** an account is created automatically (no separate sign-up step); **Given** a returning one, **Then** the same flow signs them back in.
4. **Given** the learner closes or cancels the Google account picker, **When** they return to the app, **Then** they are still signed out, no error is shown as a failure, and they can try again or choose the email code.
5. **Given** a learner with several Google accounts on the phone, **When** the picker opens, **Then** they choose which one to use and can add another account from there.

---

### User Story 2 - One person, one account across both methods (Priority: P1)

A learner who earlier signed in with an emailed code can later tap "Continue with Google" with the same address and land in the same
account with the same history, and the other way round.

**Why this priority**: without it, testers who already signed in by email would silently end up with a second, empty account and the owner would see two people.

**Independent Test**: Create an account by email code, sign out, sign in with Google using the same address; confirm it is the same account (same progress, one entry in the owner's view). Repeat in the opposite order.

**Acceptance Scenarios**:

1. **Given** an account created by email code, **When** the learner signs in with Google using the same address, **Then** they enter that same account.
2. **Given** an account created by Google, **When** the learner requests an email code for the same address and enters it, **Then** they enter that same account.
3. **Given** a Google account whose email Google reports as not verified, **When** it is used to sign in, **Then** sign-in is refused with a plain explanation and no account is created or entered.
4. **Given** two different Google accounts on one phone, **When** they sign in one after the other, **Then** they are two accounts, each attributed to whoever is signed in at that time.

---

### User Story 3 - Skip, sign out and delete work the same (Priority: P2)

Everything spec 005 promises around the account applies unchanged to a Google-created or Google-entered account: Skip on the offer,
sign-in reachable later from Settings, sign out, in-app account deletion, deletion request on the website.

**Why this priority**: required by the store for any account system, and by the owner's "never in the way of practising" rule; mostly inherited, but each must be shown to work for this method.

**Independent Test**: Sign in with Google, sign out, confirm the app is anonymous; sign in again, delete the account from Settings, confirm the email and links are gone and a later Google sign-in creates a brand-new empty account.

**Acceptance Scenarios**:

1. **Given** the first-launch offer, **When** the learner taps Skip, **Then** nothing about Google is requested and every feature works.
2. **Given** a learner signed in with Google, **When** they sign out and confirm, **Then** the app shows the signed-out state and stops attributing data to them; the Google account on the phone is not signed out of Google itself.
3. **Given** a learner signed out, **When** they tap "Continue with Google" again, **Then** the account picker is shown again (the app does not silently re-use the previous Google account).
4. **Given** a signed-in learner, **When** they delete their account and confirm, **Then** the email, account, sessions and device links are removed, and the app returns to the anonymous state.
5. **Given** a deleted account, **When** the same Google account signs in later, **Then** a brand-new account with no history is created.
6. **Given** the learner signed in with Google, **When** they open Settings, **Then** the deletion confirmation names the same things as for email sign-in, and the learner is told that their Google account itself is not touched.

---

### User Story 4 - Attribution and device link (Priority: P2)

Signing in with Google links the device to the account exactly like the email code does: new usage events and crash reports carry the email, earlier events from that device become attributable, signing out stops it.

**Why this priority**: this is the payoff for the owner; it must hold for the new method too.

**Independent Test**: Sign in with Google on a test phone, run a session, force a test crash; the owner's usage view and crash tool show the email. Sign out, run another session; new events are anonymous.

**Acceptance Scenarios**:

1. **Given** a learner signs in with Google, **When** they practise, **Then** each new usage event and crash report carries their email.
2. **Given** the device recorded events before sign-in, **When** the learner signs in, **Then** those earlier events become attributable to the account.
3. **Given** a learner signs out, **When** they practise, **Then** new events and crash reports carry no email.

---

### User Story 5 - Reviewer and offline behaviour stay intact (Priority: P3)

The reviewer test account of spec 005 (fixed email + fixed code) keeps working with Google sign-in present, and a Play reviewer without a Google account on the phone can still use the app or sign in by the email route.

**Why this priority**: Google sign-in cannot be assumed to work for a reviewer (no personal Google account, emulator without Play services).

**Independent Test**: On a device with no Google account, open the sign-in screen: the email route and Skip are fully usable, and Google reports a plain problem instead of failing silently.

**Acceptance Scenarios**:

1. **Given** the reviewer test account is enabled, **When** its fixed email and code are used, **Then** sign-in works exactly as in spec 005.
2. **Given** a phone with no Google account or no Google services, **When** the learner taps "Continue with Google", **Then** they are told what is missing and what to do (add an account, or use the email code), and the email route stays available.
3. **Given** no network, **When** the learner taps "Continue with Google", **Then** they get an actionable "can't reach the service" message and practice is unaffected.

---

### Edge Cases

- The learner dismisses the Google account picker: treated as "cancelled", not as an error (US1 scenario 4).
- Google returns an identity the service cannot verify (expired, tampered, issued for another app): sign-in is refused with a plain message and nothing is stored.
- The same Google identity is used on two phones: both are signed in to the one account.
- Account deleted on one phone while signed in on another: the other phone is signed out the next time it contacts the service (as spec 005).
- A learner changes the email address of their Google account later: they sign in under the new address and get a new account; changing an email on an account stays out of scope (spec 005). The old account keeps working by email code.
- Slow or interrupted network after the Google pick, before the app finishes signing in: the learner sees a retry message; no half-signed-in state is kept.
- Learner taps "Continue with Google" repeatedly: only one sign-in attempt runs at a time.
- Google sign-in is switched off or not configured on the server: the Google button is hidden or explains the problem; the email route is unaffected.
- The app build lacks Google sign-in support (an older install that received an over-the-air update of the screen): the button must not appear and break; older builds keep working by email.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The sign-in screen MUST offer "Continue with Google" next to the email-code route; the two MUST be presented as equal choices, and neither MUST be required.
- **FR-002**: Google sign-in MUST be optional under the same rules as spec 005 (FR-002, FR-003): every feature works without an account, the offer has a one-tap Skip, and sign-in stays reachable from Settings.
- **FR-003**: Tapping "Continue with Google" MUST let the learner choose which Google account to use and MUST NOT silently reuse a previously used account after sign-out.
- **FR-004**: A successful Google sign-in MUST sign the learner in; if no account exists for the verified email, one MUST be created in the same step.
- **FR-005**: Identity MUST be the verified email address, compared case-insensitively as in spec 005 (FR-004). A Google sign-in whose address matches an existing account (created by either method) MUST enter that account; two accounts for one address MUST never exist.
- **FR-006**: The service MUST accept a Google sign-in only when Google vouches that the email is verified, and only when the identity was issued for this app; otherwise it MUST refuse with a plain explanation and create no account and no session.
- **FR-007**: The service MUST verify the Google identity itself; the app MUST NOT be trusted to state who the learner is.
- **FR-008**: Google sign-in MUST end in the same kind of signed-in state as the email code (spec 005 FR-010): persisted across restarts, with a revocable session, linked to the device (FR-011), and ended by sign-out or deletion.
- **FR-009**: Signing out of a Google-created or Google-entered account MUST behave as spec 005 FR-012/FR-013 and MUST NOT sign the learner out of their Google account on the phone.
- **FR-010**: Account deletion (in the app and by the website request page) MUST behave as spec 005 FR-014–FR-016 for these accounts, and the in-app confirmation MUST say that the learner's Google account itself is not deleted or changed.
- **FR-011**: Usage events and crash reports MUST be attributed after Google sign-in, and earlier events from the same device MUST become attributable, exactly as spec 005 FR-011.
- **FR-012**: Cancelling the Google account picker MUST leave the learner signed out without an error state.
- **FR-013**: Every error on the sign-in screen for this method (no Google account on the phone, no Google services, unverified email, unverifiable identity, offline, server unavailable, not configured) MUST state what happened and what the learner can do next in plain language, offering the email route where relevant (Constitution III, spec 005 FR-019).
- **FR-014**: When Google sign-in is not available (not configured on the service, or not supported by the installed build), the Google control MUST NOT be shown as a broken control; the email route and Skip MUST be unaffected.
- **FR-015**: The Google control MUST carry an accessible label, meet the project's contrast and touch-target baseline, follow Google's branding rules for sign-in buttons, and keep its layout at the largest OS font size (spec 004).
- **FR-016**: The Google identity credential and the session credential MUST NOT appear in logs, usage events or crash reports (spec 005 FR-022). Only the verified email and the account are stored; no name, photo or other Google profile data is collected.
- **FR-017**: The spec-005 reviewer test account (fixed email + code), rate limits and one-time-code rules MUST be unchanged by this feature.
- **FR-018**: The privacy policy page and the store data-safety declaration MUST be updated to name Google as a sign-in method and state that only the email address is received from it, before the first build that contains Google sign-in is submitted.
- **FR-019**: Sign-in with Google MUST NOT alter anonymous behaviour for a learner who never signs in (spec 001 FR-019, spec 005 FR-023).

### Key Entities

- **Account**: unchanged from spec 005 — one person, identified by a verified email. It may be entered by either method; the method is not part of the identity.
- **Google identity assertion**: a short-lived, signed statement from Google that a given email is verified and that it was issued for this app; verified once by the service at sign-in and not stored.
- **Device link / Signed-in session**: unchanged from spec 005; created by Google sign-in in the same way as by the email code.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A learner with a Google account on their phone goes from the sign-in screen to signed-in in at most 4 taps and under 20 seconds of their own time (no inbox, no typing).
- **SC-002**: At least 80% of beta testers who start sign-in on a build with Google choose or complete it within the first 7 days, and at least 95% of Google attempts that are not cancelled by the learner finish on the first try.
- **SC-003**: After the Google account is picked, the learner sees themselves signed in within 3 seconds on a normal mobile connection.
- **SC-004**: In a test with one address used by both methods in both orders, 100% of cases land in one account, and 0 duplicate accounts exist afterwards.
- **SC-005**: Over a test session, 100% of usage events and crash reports after Google sign-in carry the account's email, and 0% after sign-out.
- **SC-006**: 100% of identities that are unverified, expired, altered or issued for another app are refused, and none creates an account or session.
- **SC-007**: A learner who cancels the picker, has no Google account, or is offline is told what to do next in 100% of cases, and the email route and Skip stay usable in all of them; a full practice cycle from a fresh install works with sign-in skipped.
- **SC-008**: After an account deletion completes, the email cannot be found in the account store, usage events or the crash tool's user field, regardless of which method created or entered the account.

## Assumptions

- Testers are on Android phones with Google Play services and at least one Google account; the owner knows each personally, so a verified Google email is enough identity (no names or avatars are collected).
- Sign-in needs its own Google-side registration (an OAuth client and a consent screen that asks for nothing beyond the email address). This is an owner-side setup step, tracked in the plan, not in this spec.
- Whether the feature reaches testers by an over-the-air update or needs a new store build is a plan-level choice (see plan.md); installs without the feature keep working by email code in either case.
- iOS: the iOS build is not part of this scope. If an iOS release ever offers Google sign-in, the App Store rule requiring an equivalent sign-in option from the platform vendor must be checked and its own spec written.
- The account store keys on the email; the method that created the account is not recorded as identity. Whether to record it for the owner's information is a plan-level decision.
- Beta traffic is tiny (about 14 people); no new performance budget beyond SC-003.
- Out of scope: Apple or any other provider, passwords, profile editing, mandatory sign-in, changing the email of an account, linking multiple different emails to one account, reading any Google data beyond the verified email, and any restore logic (provided by spec 019).
- Dependencies: spec 005 (account, session, device link, deletion, reviewer account, sign-in screen), spec 019 (progress follows the account), spec 004 (accessibility baseline); `docs/beta-checklist.md` item "Вход через Google"; the privacy page and Play Data Safety form (FR-018). Spec 005's "Google out of scope" notes get an amendment pointing here.
