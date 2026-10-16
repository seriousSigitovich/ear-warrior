# Implementation Plan: Video Publishing (YouTube + Instagram)

**Branch**: `007-video-publishing` (not created) | **Date**: 2026-10-16 | **Spec**: [spec.md](spec.md)

## Summary

A local command in `server/` (`npm run publish -- --file … --title … --caption …`) validates a rendered video with `ffprobe`, builds the platform texts, prints a plan, and — only with `--confirm` — uploads to YouTube (resumable upload, private) and Instagram (resumable Reel upload, processing poll, publish), then appends a record to `docs/published.json`. Pure parts (probe parsing/validation, text assembly, ledger) are unit-tested; the two platform clients run against a scripted fake `fetch`.

## Technical Context

**Language/Version**: TypeScript 5.6 on Node 20 (ESM), as `server/` · · **Dependencies**: `@vercel/blob` (temporary public address for Instagram only), otherwise global `fetch`, `node:util` `parseArgs`, system `ffprobe`

**Storage**: `docs/published.json` (tracked, no secrets) · **Testing**: `node:test` via `tsx` (`npm test`)

**Target Platform**: macOS dev machine — **not deployed** (write credentials stay local) · **Project Type**: CLI inside the existing backend package

**Performance Goals**: dry run < 5 s; upload-to-link < 2 min for a 40 s Short · **Constraints**: dry run by default, no secrets in output, YouTube quota ≈ 1 600 units/upload, Instagram container expires after 24 h

## Constitution Check

| Principle | Status | Plan |
|---|---|---|
| I. Code quality | Partial | Matches `server/src/social/` conventions; the package still has no linter (spec 006 T020). |
| II. Test-first | Pass | Tests for the pure modules and both clients (fake fetch) are written before the code they cover; dry-run-makes-no-network-call has its own test. |
| III. UX consistency | Pass | Errors name the problem and the next step; output reads like `voice.md` (plain, specific). |
| IV. Performance | Declared | Targets above; measured in the first live runs (T012). |

## Project Structure

```text
specs/007-video-publishing/{spec.md, plan.md, tasks.md}
server/src/publish/
├── types.ts        # Platform, PublishError, request/record shapes
├── video.ts        # parseProbe, validateForPlatform, parseVideoNo, probeVideo (ffprobe)
├── text.ts         # normalizeTags, utmUrl, buildYoutube, buildInstagram (limits)
├── ledger.ts       # load/find/add/save docs/published.json
├── youtube.ts      # resumable upload (private)
├── hosting.ts      # temporary public address (Vercel Blob) for Instagram's video_url
├── instagram.ts    # container from video_url + poll + publish
├── run.ts          # the command's logic (plan, --confirm, ledger, failure isolation)
├── *.test.ts
server/src/publish.ts           # CLI entry: npm run publish
server/src/youtube-auth.ts      # + `--upload`: consent for the upload scope only
docs/published.json             # the record
```

**Structure Decision**: same package as the analytics backend (shared conventions and tooling) but separate directory and entry point; nothing under `src/publish/` is imported by `app.ts` or the Vercel entry, so the hosted function never reads or needs the write credentials.

## Complexity Tracking

| Choice | Why | Simpler alternative rejected |
|---|---|---|
| Temporary Vercel Blob copy for Instagram's `video_url` | the live API rejects resumable uploads (verified 2026-10-16); Blob is already in the owner's account and the copy is deleted after processing | a tunnel from this machine (extra tool, flaky); a permanent public folder on the landing (a public copy that stays) |
| Separate write credentials | a leaked analytics token must not be able to post | reusing the read token's grant — widens the blast radius |
| Dry run by default | publishing is outward-facing and irreversible-ish | a `--dry-run` opt-in — one forgotten flag publishes |
