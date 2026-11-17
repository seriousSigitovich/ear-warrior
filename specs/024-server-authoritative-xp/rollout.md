# Rollout: spec 024

Order matters: the server ships first and is additive; the old app keeps working until the new one is adopted.

1. **Local check** (done 2026-11-16): `cd server && npm test` (522, Postgres included), root `npx jest` (655), `npx eslint app src tests --ext .ts,.tsx`, `npx tsc --noEmit -p tsconfig.app.json`.
2. **Owner review** (FR-014, T048): approve or change in `server/src/game/config.ts` — rank thresholds `0, 100, 450, 2000, 5000, 12000, 32000`, level multipliers `1, 1.5, 2, 3, 4, 6, 8, 11, 15`, daily cap `300` base XP. `server/src/game/config.test.ts` must stay green.
3. **Deploy the server** (Vercel, `ear-warrior-api`). The tables are created at boot by `applyDdl`. Env: `BLOB_READ_WRITE_TOKEN` (already used by publishing), `ADMIN_PASSWORD`; optional `LEGACY_IMPORT_UNTIL` (default 2026-12-31).
4. **Seed and upload the tunes**:
   ```bash
   cd server
   npx tsx --env-file=.env scripts/upload-tunes.ts --dry-run
   npx tsx --env-file=.env scripts/upload-tunes.ts
   curl -s https://<api>/api/melodies | head -c 400     # beats and moves, no notes
   ```
5. **Migration dry run on production data** (T043): `curl -u admin:… -X POST https://<api>/admin/recompute` (dry run by default). Look at `byRank` and the per-account old vs new XP; save the numbers in `migration-report.md`. Then `?dry_run=0`; running it again changes nothing.
5a. **Shipped tunes**: after any change to levels 1–2 or their clips run `server/node_modules/.bin/tsx scripts/build-shipped-tunes.ts` (writes `shippedTunes.ts` and the clip registry) so the app's copy matches what `upload-tunes.ts` uploads.
6. **Store build** of the app (the bundle shrinks, so an OTA cannot do it). Test on a device first: fresh install offline (every L1–L2 tune plays and is graded at once; levels 3+ say they need a connection), online (clips download, the second play makes no request), airplane mode during a phrase (Check shows "waiting"), sign-in after playing anonymously (XP is kept).
7. **After adoption**: set `GAMIFICATION_GONE=1` so the old reward endpoints answer 410.

Not verified yet: anything on a real device or against the deployed server.
