# Quickstart & Validation Guide: Guitar Ear Training

**Feature**: 001-guitar-ear-training | **Date**: 2026-07-22

Automated unit + contract tests cover the pure logic and service boundaries (see the Testing section of
[plan.md](./plan.md) and each file in [contracts/](./contracts)). This guide is the **on-device
validation gate** for behavior unit tests cannot reach — real pitch-detection accuracy, audio fidelity,
microphone permissions, and the offline loop — validating each user story against its acceptance
scenarios on a physical device.

> Requires a **physical iOS/Android device** (microphone + speakers) and a **guitar in standard tuning**.
> Pitch detection does not work on simulators without mic input.

## Prerequisites

- Node LTS, and an Expo account with EAS access (`npx eas login`).
- A Supabase project with the `attempt_log` table + insert-only RLS applied
  (see [contracts/supabase-attempt-log.md](./contracts/supabase-attempt-log.md)).
- Pre-rendered note/chord samples present in `assets/samples/` covering each difficulty level's note
  pool.
- Env: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` configured.

## Setup

```bash
npm install
```

Apply the Supabase migration (once):

```bash
supabase db push   # or run supabase/migrations SQL in the Supabase SQL editor
```

## Build the dev client (not Expo Go)

```bash
# iOS (TestFlight/ad-hoc) and Android internal distribution dev clients
npx eas build --profile development --platform ios
npx eas build --profile development --platform android
```

Install the resulting build on each tester device (TestFlight invite for iOS; install link for Android).

## Run

```bash
npx expo start --dev-client
```

Open the app from the installed dev client and grant the **microphone permission** when prompted.

## Validation scenarios

Each maps to acceptance criteria in [spec.md](./spec.md). Mark pass/fail per device.

### US1 — Listen, play back, get feedback (P1, MVP)

1. **Turn signal**: Start a session → app plays a melody → a clear "your turn" cue appears when playback
   ends. *(FR-002, FR-003; US1 #1)*
2. **Correct attempt**: Play the exact notes in order → verdict = **correct**, all notes shown matched.
   *(US1 #2; SC-002)*
3. **Wrong attempt**: Play a wrong note → verdict = **incorrect**, the specific note flagged
   wrong/missed/extra. *(US1 #3)*
4. **Replay**: Trigger replay → identical melody plays. *(US1 #4)*
5. **Retry**: Retry → same melody re-graded fresh. *(US1 #5)*
6. **Next**: Continue → a new melody is presented. *(US1 #6)*
7. **Latency**: Feedback appears **within 2 s** of finishing playing. *(SC-003)*
8. **Timeout**: Don't play → app prompts replay/retry, does not grade an empty attempt. *(FR-015)*
9. **Out-of-tune**: Detune a string → app warns and offers a reference tone. *(FR-014)*

### US2 — Difficulty (P2)

1. Set a fixed level → generated melodies match its note count / range / tempo. *(US2 #1, #4)*
2. Answer several correct in a row (adaptive) → difficulty increases. *(US2 #2)*
3. Fail several in a row (adaptive) → difficulty decreases. *(US2 #3)*

### US3 — Progress (P3)

1. Complete attempts across two sessions → progress view shows accuracy trend + practice volume.
   *(US3 #1, #3)*
2. Weak-areas view highlights the most-missed melody characteristics. *(US3 #2)*
3. Force-quit mid-session → completed attempts survive on relaunch. *(FR-018, interrupted-session edge case)*

### Telemetry & offline

1. **Online logging**: Complete an attempt → a matching row appears in Supabase `attempt_log` with no
   PII/audio. *(contracts/supabase-attempt-log.md)*
2. **Offline core loop**: Enable airplane mode → the full listen→play→feedback loop still works; logs
   queue locally and flush after reconnecting. *(offline-core-loop constraint, R9)*

## Expected outcome

All US1 scenarios pass on both an iOS and an Android tester device, with verdicts matching a human
listener on the introductory difficulty (SC-002), and the offline loop fully functional. US2/US3 pass
once those stories are implemented. Record failures against the specific FR/SC for follow-up.
