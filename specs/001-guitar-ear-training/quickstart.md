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
- The **Node/Postgres backend** (`server/`) running and reachable. For local validation:
  `cd server && cp .env.example .env && docker compose up --build` (Postgres + Fastify on :8080; it
  applies its schema — `attempt_log`, `signups`, `sync_documents` — at boot). See
  [contracts/attempt-log.md](./contracts/attempt-log.md).
- No audio assets to prepare — playback tones are **synthesized at runtime** (Karplus–Strong) and cached
  on first use (R6).
- Env: `EXPO_PUBLIC_API_URL` pointing at the backend (e.g. `http://<your-lan-ip>:8080`). Unset → the app
  runs fully offline and simply logs/syncs nothing.

## Setup

```bash
npm install
```

Start the backend (applies its schema on boot — no separate migration step for dev):

```bash
cd server && cp .env.example .env && docker compose up --build   # Postgres + Fastify on :8080
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

1. **Fixed level**: set fixed rank *r* → every generated melody has exactly `r + 1` notes, all drawn from
   C major C4–C5 at 60 BPM, and the rank never moves on its own. *(US2 #1, #4)*
2. **Promotion**: in adaptive mode, answer **3 consecutive new melodies** correctly on the first attempt →
   the next melody has one more note. *(US2 #2)*
3. **Demotion**: fail **2 consecutive new melodies** on the first attempt → the next melody has one fewer
   note. *(US2 #3)*
4. **Retries are invisible**: fail a melody, then retry it repeatedly (right or wrong) → the rank does not
   move and the streak is unaffected. *(FR-011a; US2 #6)*
5. **Noise does not demote**: force two low-confidence captures (play over background noise, or mute the
   guitar) → the app offers retry and the rank stays put. *(FR-011a, FR-017 — the key anti-frustration case)*
6. **Mode round-trip**: reach adaptive rank 5, switch to fixed rank 2, practice, then switch back to
   adaptive → you resume at rank 5. *(FR-011b; US2 #5)*
7. **Ceiling**: at rank 7, answer 3 more correctly → rank stays 7, nothing breaks. *(US2 #7)*
8. **Restart persistence**: force-quit and relaunch → mode, adaptive rank, and fixed selection are all
   preserved. *(FR-011b)*

### US3 — Progress (P3)

1. Complete attempts across two sessions → progress view shows accuracy trend + practice volume.
   *(US3 #1, #3)*
2. Weak-areas view highlights the most-missed melody characteristics. *(US3 #2)*
3. Force-quit mid-session → completed attempts survive on relaunch. *(FR-018, interrupted-session edge case)*

### Telemetry & offline

1. **Online logging**: Complete an attempt → a matching row appears in the backend `attempt_log` table
   (`POST /api/attempts`) with no PII/audio. *(contracts/attempt-log.md)*
2. **Offline core loop**: Enable airplane mode → the full listen→play→feedback loop still works; logs
   queue locally and flush after reconnecting. *(offline-core-loop constraint, R9)*
3. **No audio / PII egress**: with a network proxy or device traffic inspector, confirm outbound traffic
   carries only the anonymized `attempt_log` payload — no audio, raw frames, note-by-note pitches, or
   PII. *(SC-008, FR-019)*
4. **History sync**: complete a few attempts online, then clear the app's local data (or reinstall the dev
   client) and relaunch → prior sessions/attempts are pulled back from the backend (`GET /api/sync`), so
   Postgres is the durable source of truth while the device stays an offline cache. *(R8/R9)*

### Accessibility (SC-009)

1. **Screen reader**: with VoiceOver (iOS) / TalkBack (Android) enabled, complete the full US1 loop using
   the screen reader only — every control announces a meaningful label + role and focus order is logical.
2. **Contrast & targets**: verify text/icon contrast ≥ 4.5:1 and touch targets ≥ 44pt (iOS)/48dp
   (Android) on the core controls.
3. **Font scaling**: set the OS to its largest standard text size → all screens stay usable, with no
   clipped or overlapping controls. *(SC-009)*

## Expected outcome

All US1 scenarios pass on both an iOS and an Android tester device, with verdicts matching a human
listener on the introductory difficulty (SC-002), the offline loop fully functional, no audio/PII leaving
the device (SC-008), and the accessibility baseline met (SC-009). US2/US3 pass once those stories are
implemented. Record failures against the specific FR/SC for follow-up.
