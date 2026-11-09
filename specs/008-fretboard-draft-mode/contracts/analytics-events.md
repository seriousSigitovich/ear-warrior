# Analytics contract: draft

Endpoint unchanged: `POST /api/events` (server/src/routes/events.ts). The server allowlist (`EVENT_NAMES`) and the
client `AppEventName` both gain `draft_on`. **Deploy the server before the OTA that sends it.**

## `draft_on` (new)

Sent each time the learner switches draft on (not on off).

| Prop | Type | Example |
|------|------|---------|
| `rank` | number | 3 |
| `phrase` | number (1-based) | 2 |
| `phrases` | number | 4 |

## `answer_check` (extended)

Existing props unchanged, plus:

| Prop | Type | Meaning |
|------|------|---------|
| `draft` | boolean | draft was on at least once while answering this phrase (since its start or last check) |

Total props on `answer_check`: 9 (server limit 10).

No per-tap event; no fret or note data in any draft event. Draft taps never send `answer_start`.
