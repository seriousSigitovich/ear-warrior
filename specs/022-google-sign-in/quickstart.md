# Quickstart: validating Google sign-in

Contracts: [google-auth-api.md](./contracts/google-auth-api.md), [client-google.md](./contracts/client-google.md). Data: [data-model.md](./data-model.md).

## 1. Automated (no Google account needed)

```bash
cd server && npm test            # route + store contract tests (Google is a fake fetch)
cd .. && npm test                # app unit/contract tests
```

Expect: all green; the logging test proves ticket, verifier, state, code and tokens never reach a log line.

## 2. Google-side setup (owner, once)

1. console.cloud.google.com → **new project** (not the YouTube one, research R7) → *Google Auth Platform* → External, app name "Ear Warrior", support email, scopes `openid` + `email` only → **Publish app** (Production).
2. *Clients* → Create client → **Web application**; authorised redirect URI: `https://ear-warrior-api.vercel.app/api/auth/google/callback`.
3. Vercel env of the server project: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`; redeploy the server.
4. `curl https://ear-warrior-api.vercel.app/api/auth/providers` → `{"ok":true,"email":true,"google":true}`.

## 3. Server by hand (curl + a desktop browser)

1. `curl -X POST …/api/auth/google/start` → `url` + `verifier`. Open `url` in a desktop browser, pick an account, accept.
2. The return page appears with a "Back to Ear Warrior" link; copy the `ticket` from the link.
3. `curl -X POST …/api/auth/google/exchange -H 'content-type: application/json' -d '{"ticket":"…","verifier":"…","device_id":"dev_<32 hex>"}'` → `{ok:true,token,email,created}`; the same call again → `401 invalid_ticket`.
4. `GET /api/auth/me` with the token → the email. Same address by email code later → same `users` row (SC-004).

## 4. Timings (Constitution IV)

`curl -w '%{time_total}'` on `start` and `exchange`, 10 runs: p95 < 300 ms. The callback is bounded by Google; note the observed time.

## 5. Real Android phone (the part tests cannot prove)

Build under test: the current production build + the OTA from this branch (or a dev build).

1. Sign-in screen shows "Continue with Google" above the email code. Airplane mode → tap → "Can't reach the server", practice still works.
2. Online: tap → browser opens on Google's **account chooser** → pick → the return page → **tap or auto** returns to the app, signed in (record: auto-return worked yes/no, which browser — research R4 risk).
3. Kill the app while in the browser, finish sign-in → the link reopens the app and completes (R5).
4. Cancel at Google ("Cancel"/back) → app stays signed out, no error.
5. Sign out → tap Google again → the chooser appears again (FR-003).
6. Same address via email code → same account; progress (spec 019) appears on a second install.
7. Delete account: the confirmation says the Google account is not changed; afterwards Google sign-in creates an empty account.
8. TalkBack: button label "Continue with Google"; largest OS font: layout intact (spec 004).
9. Sentry/event attribution: a session after sign-in carries the email; after sign-out it does not.
