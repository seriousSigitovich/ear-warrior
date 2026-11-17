# Data Model: Server-Authoritative XP, Ranks and Melody Library

All tables are created by the idempotent DDL in `server/src/db/ddl.ts` (same pattern as the existing tables) and mirrored in `schema.ts`.

## tunes

| Column | Type | Notes |
|---|---|---|
| id | text PK | hyphen-free, `^[a-z0-9]{1,60}$` (matches today's ids) |
| title | text | |
| level | smallint | 1–9, check constraint |
| tempo_bpm | real | quarter notes per minute |
| phrases | int[] | note count per phrase; sum = note count |
| notes | text | answer: `pitch:beats` tokens (server only) |
| scale | text | `<Root>_<family>` as in the library |
| source | text | provenance |
| audio_url | text null | Blob URL of the voiced m4a |
| audio_sha256 | text null | hex; the cache key |
| audio_bytes | int null | |
| hidden | boolean | default true until audio is set; hidden tunes are not in the catalog |
| updated_at | timestamptz | catalog version = hash of (id, level, audio_sha256, updated_at) of visible tunes |

Validation: phrases sum equals the number of tokens in `notes`; every pitch within MIDI 40–76; level 1–9; audio set before `hidden = false`.

## users (changed)

`email` becomes nullable; new `anonymous boolean not null default false`; unique index on lower(email) stays (NULLs allowed). Anonymous users have no email and are deleted at merge.

## phrase_checks

One row per check (idempotent).

| Column | Type | Notes |
|---|---|---|
| user_id | uuid FK | cascade |
| check_id | text | client UUID; PK with user_id |
| tune_id | text | |
| phrase | smallint | index |
| attempt_no | int | computed at insert: earlier checks of this phrase + 1 |
| played | smallint[] | midi in tap order (≤ 64) |
| note_results | jsonb | grader output |
| accuracy | smallint | 0–100 |
| passed | boolean | accuracy ≥ pass mark |
| xp | int | paid by this check (0 unless it is the paying check) |
| local_day | date | device-reported, bounded to ±1 day of server time |
| checked_at | timestamptz | device time, bounded; `received_at` = server time |

## phrase_events

Hints and answer reveals: `(user_id, tune_id, phrase, kind ∈ {hint, answer}, at)`; unique per (user, tune, phrase, kind) before the phrase is paid.

## xp_ledger

Append-only; total XP = sum.

| Column | Type | Notes |
|---|---|---|
| user_id | uuid FK | |
| key | text | unique with user_id: `phrase:<tune>:<phrase>`, `challenge:<day>:<id>`, `daily-all:<day>`, `legacy:<tune>:<phrase>` |
| kind | text | phrase / challenge / daily-all |
| xp | int ≥ 0 | |
| breakdown | jsonb | base, bonus, level_mult, attempt_factor, hint_factor, cap_factor (for display and audit) |
| local_day | date | |
| at | timestamptz | |
| seq | bigserial | order of arrival |

## daily_xp

`(user_id, local_day) PK, base_xp int` — base XP used toward the cap.

## Derived (not stored)

- **Total XP**: `sum(xp_ledger.xp)`.
- **Rank**: highest rank in `game/config.ts` whose threshold ≤ total XP; next rank and XP to it.
- **Streak**: consecutive local days (ending today or yesterday) having a ledger row.
- **Phrase status** (for the Melodies/Journey screens): passed / open per (tune, phrase) from `phrase_checks`.

## Removed

`progress_game_rows` stops being read; mastery and completion kinds are dropped after the cutover. `progress_attempts` is kept (history, recompute source).

## State transitions of a phrase (per account)

`untouched → (checks, hints/answer events) → passed(paid)`; once `passed`, further checks are stored with `xp = 0` and never change the ledger.

## Device side

- `ew.checkQueue` (key-value): ordered list of `{check_id, tune_id, phrase, played, checked_at, local_day}`.
- Audio cache: directory `tunes/`, files `<id>.<sha8>.m4a`.
- Catalog snapshot + ETag (key-value) for offline start.
- SQLite XP tables (`xp_awards`, `completions`, `mastery`, `gamification_meta`) are dropped after the first successful `GET /api/progress/state`.
