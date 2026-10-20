# Quickstart: validating optional email sign-in

Runnable checks that prove the feature end to end. Contracts: [auth-api.md](./contracts/auth-api.md),
[client-auth.md](./contracts/client-auth.md). Tables: [data-model.md](./data-model.md). Paths are relative to
the repository root.

## 0. Prerequisites

- Postgres via the repo's compose file: `cd server && docker compose up -d`.
- `server/.env` with `DATABASE_URL`, `AUTH_PEPPER` (any long random string for local), and either
  `SMTP_USER`/`SMTP_PASS` or `MAIL_DRIVER=console` (prints the code to the server log; local only).
- For the reviewer-account check also set `AUTH_TEST_EMAIL=review@example.com`, `AUTH_TEST_CODE=424242`.

## 1. Automated suites (must be green; written first)

```bash
cd server && npm test          # includes src/auth/*.test.ts and src/routes/auth.test.ts
cd .. && npm test              # Jest: tests/unit/lib/email, tests/unit/auth/*, tests/contract/authClient
cd server && npm run typecheck
```

## 2. Server flow with curl (local)

```bash
cd server && npm run dev
# in another terminal:
curl -s -X POST localhost:3000/api/auth/request -H 'content-type: application/json' -d '{"email":"Me@Example.com "}'
# read the 6-digit code from the mail (or the console log)
curl -s -X POST localhost:3000/api/auth/verify  -H 'content-type: application/json' \
  -d '{"email":"me@example.com","code":"123456","device_id":"dev_00000000000000000000000000000000"}'
```

Expected: request → `{ok:true,resend_after_s:60,expires_in_s:600}`; verify → `{ok:true,token,email,created:true}`;
the same code again → `401 no_code`; `GET /api/auth/me` with the token → the email.

## 3. Abuse checks (SC-007)

| Check | Expected |
|-------|----------|
| 5 wrong codes, then the right one | 5th wrong → `too_many_attempts`; the right code is refused; a new request works |
| Wait past 10 minutes (or use the test clock in `auth.test.ts`) | `code_expired` |
| 6 requests for one address within an hour | 6th → `429 rate_limited` with `retry_after_s` |
| Two requests within 60 s | 2nd → `429` |
| Request for an address with an account vs. without | byte-identical bodies |
| Request a new code, then use the old one | `no_code` (superseded) |

## 4. Attribution and deletion

1. Run a practice cycle on a device/emulator **anonymously** (an `attempt_log` row appears with `device_id`).
2. Sign in on that device. Query the owner's attributed view: the earlier row now resolves to the account's email.
3. Practise again → new row resolves to the email. Sign out → practise → new row resolves to *anonymous*;
   the earlier two keep the email (FR-011/012).
4. Delete the account in the app → the user, sessions and links are gone; all those rows resolve to
   anonymous; signing in with the same email creates a **new** account.
5. Second phone signed in to the same account: delete on phone A, open phone B → B returns to the signed-out
   state on its next `me` call.

## 5. On-device checks (Android, `preview` APK)

- [ ] First launch: the offer shows once; **Skip** is one tap; the app is fully usable afterwards.
- [ ] Settings → Account → sign in: invalid email is rejected on the screen with no request; a real mailbox
      gets the code ≤ 60 s; correct code → signed in; kill and reopen the app and reboot the phone → still signed in.
- [ ] Wrong code shows attempts left; "Send a new code" is disabled until the countdown ends.
- [ ] Airplane mode: sign-in shows the "can't reach the server" copy; practice still works.
- [ ] Sign out and Delete account each ask for confirmation; Cancel changes nothing.
- [ ] TalkBack reads every control and every error; largest font size keeps the layout intact (FR-020).
- [ ] Time budgets (declared in plan.md): code verified → signed-in within 2 s on mobile data; flow under 90 s excluding mail wait.

## 6. Reviewer test account (SC-009)

With `AUTH_TEST_EMAIL`/`AUTH_TEST_CODE` set: sign in on a device with `review@example.com` + `424242` — no mail is
sent and the session works. Then unset both, redeploy, and confirm the same pair is refused. Confirm
`someone-else@example.com` + `424242` is refused while enabled.

## 7. Web deletion route

`landing/delete-account/` is reachable without signing in, states the 7-day completion time, and the
privacy page links to it. Run `cd server && npm run delete-user -- me@example.com` and confirm the same
removals as in 4.

## 8. Release gate for this feature

- `expo-secure-store` is in the dependencies of the build submitted to Play.
- `landing/privacy/index.html` and the Play Data Safety form list: email address, account identifier,
  sign-in method (emailed code), deletion route (FR-021).
- Vercel project `ear-warrior-api` has `AUTH_PEPPER`, `SMTP_USER`, `SMTP_PASS` (and, only while the store
  review may need it, the test-account pair).
