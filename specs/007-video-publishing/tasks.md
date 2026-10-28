# Tasks: Video Publishing (YouTube + Instagram)

**Input**: `specs/007-video-publishing/` · **Status 2026-10-16**: T001–T012 done (72 tests passing). Both paths are verified live up to — not including — a public post: Instagram stage-only, YouTube private upload. Left: the first real publish (needs the owner's yes per video), T013 (map posts to experiments in the analytics page), T014 (audit decision).

**Tests**: required (constitution II) and written before the code they cover.

## Phase 1: Foundations (pure logic, test-first)

- [x] T001 [P] [US1] Probe parsing, platform validation and file-name experiment number in `server/src/publish/video.ts` with tests in `server/src/publish/video.test.ts`
- [x] T002 [P] [US1] Text assembly (tags, tracking link, YouTube/Instagram limits) in `server/src/publish/text.ts` with tests in `server/src/publish/text.test.ts`
- [x] T003 [P] [US4] Publication record (load, find, add, save) in `server/src/publish/ledger.ts` with tests in `server/src/publish/ledger.test.ts`

## Phase 2: Platform clients (fake-fetch tests first)

- [x] T004 [US3] YouTube resumable upload, private, in `server/src/publish/youtube.ts` with tests in `server/src/publish/youtube.test.ts` (headers, forced private, no secret in errors)
- [x] T005 [US2] Instagram Reel: container from `video_url`, processing poll, publish, stage-only in `server/src/publish/instagram.ts` with tests in `server/src/publish/instagram.test.ts` (resumable upload was tried first and rejected by the live API)
- [x] T005b [US2] Temporary public copy for Instagram in `server/src/publish/hosting.ts` (`@vercel/blob`), always deleted afterwards; tests in `server/src/publish/hosting.test.ts` and `cli.test.ts`
- [x] T006 [US3] Upload-scope consent: `--upload` in `server/src/youtube-auth.ts` and a scopes parameter in `server/src/social/oauth.ts`, tested in `server/src/social/collectors.test.ts`

## Phase 3: The command

- [x] T007 [US1] [US4] [US5] CLI `server/src/publish.ts` (`npm run publish`): plan by default, `--confirm`, `--platforms`, `--no-publish`, `--force`; failure isolation; exit status; test that a dry run makes no network call in `server/src/publish/cli.test.ts`
- [x] T008 `.env.example` and `server/README.md` "Publishing videos" (separate credentials, never pushed to Vercel), `docs/published.json` created empty

## Phase 4: Rights and live verification (owner steps)

- [x] T009 [US3] Owner consents the YouTube upload scope: `npm run yt:auth -- --upload` → `YT_UPLOAD_REFRESH_TOKEN`
- [x] T010 [US2] Meta app gets `instagram_business_content_publish`; owner generates a second token → `IG_PUBLISH_TOKEN`
- [x] T010b [US2] Vercel Blob store `ear-warrior-publish` (public, connected to the development environment only), read-write token in `.env` as `BLOB_READ_WRITE_TOKEN`; not on the production env. The host sweeps leftovers older than an hour before each upload (tests in `hosting.test.ts`)
- [x] T011 [US2] Live stage-only Instagram run — 2026-10-16, `ear-challenge-31.mp4`: Blob copy fetched and processed by Meta (FINISHED), copy deleted, store empty, nothing published, ledger empty
- [x] T012 [US3] Live private YouTube upload — 2026-10-16, `ear-challenge-31.mp4` as a rehearsal titled "TEST - delete me": uploaded in a few seconds; read back through the Data API: `privacyStatus=private`, not made for kids, tags, category 10, description with `utm_campaign=ear31` and `#Shorts`. The owner deletes the rehearsal in Studio; its record was removed from `docs/published.json` so the real #31 is not blocked. Owner still decides publish-in-Studio vs the Google audit (T014)

- [x] T015 [US2] Instagram photo carousel (FR-011): `publishCarousel` in `server/src/publish/instagram.ts`, slide listing/validation/JPEG conversion in `server/src/publish/images.ts`, `--images` branch in `server/src/publish/run.ts`; tests in `instagram.test.ts`, `images.test.ts`, `cli.test.ts`. Dry run verified on `assets/carousel/out/pentatonic` (2026-10-27); **no live publish yet** (carousel container flow unverified against the real API)

## Phase 5: Follow-ups

- [ ] T013 Map published post ids to experiment numbers in the analytics page (spec 006 T028)
- [ ] T014 Decide on the Google API audit (public YouTube uploads)
