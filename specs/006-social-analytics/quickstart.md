# Quickstart: validate Social Analytics end to end

Prerequisites: Docker running, Node 20+, `server/.env` created (`cp -n .env.example .env`) with `ADMIN_PASSWORD` set.

## 1. Unit tests (no network, no database)
```bash
cd server && npm test        # expect: 22+ passing; typecheck: npm run typecheck
```
Covers: window/growth rules (spec FR-005), collectors against scripted API responses incl. error paths (FR-007, FR-013), escaping (FR-012), OAuth helpers.

## 2. Database
```bash
docker compose up -d postgres      # tables are created at first start/collect
```

## 3. YouTube — one-time connection  (spec US4)
Follow `server/README.md` → "Connect YouTube": enable the two APIs, consent screen published, Web client with redirect `http://localhost:8765/callback`, `YT_CLIENT_ID`/`YT_CLIENT_SECRET` in `.env`, then:
```bash
npm run yt:auth                    # complete the consent in the browser; YT_REFRESH_TOKEN is written to .env
```

## 4. Collect and view  (US1, US2)
```bash
npm run collect                    # expect: "youtube: ok (N posts)"; "instagram: skipped — not configured"
npm run dev                        # then open http://localhost:8080/admin/social  (user admin)
```
Expected: YouTube card with lifetime views and "growth appears when history accumulates" on day one; status chip "updated just now"; Instagram "not connected".

## 5. Safety checks  (US5)
```bash
curl -s -o /dev/null -w "%{http_code}\n" localhost:8080/admin/social                       # 401
curl -s -o /dev/null -w "%{http_code}\n" -u admin:wrong localhost:8080/admin/social        # 401
# with ADMIN_PASSWORD unset the server answers 404
curl -s -o /dev/null -w "%{http_code}\n" -X POST -u admin:$PW localhost:8080/admin/social/collect  # 429 within 2 min of a run
```

## 6. Growth after a week (SC-005)
Run `npm run collect` daily (or set `SOCIAL_COLLECT_INTERVAL_HOURS=6` and keep the server up). After 7 days the 7-day card shows "+N views" and the change against the previous window once 14 days exist.

## 7. Instagram (not yet validated live)
Follow `server/README.md` → "Connect Instagram", set `IG_ACCESS_TOKEN`, `npm run collect`, and check the status chip for the platform's error text if it fails.
