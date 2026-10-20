# Contract: Auth HTTP API

Base URL: `EXPO_PUBLIC_API_URL` (`https://ear-warrior-api.vercel.app`). JSON in and out. Every error body is
`{ "ok": false, "error": "<code>", ...extras }`; every success body has `"ok": true`.

**Never logged, anywhere**: the `code`, the bearer token, and request bodies of `/api/auth/*` (FR-022).
`GET|POST|DELETE|OPTIONS` are allowed by CORS (`DELETE` is added for the account route).

Required server env: `DATABASE_URL`, `AUTH_PEPPER` (without it these routes answer `503 auth_disabled`),
`SMTP_USER`, `SMTP_PASS` (+ optional `SMTP_HOST`, `MAIL_FROM`; local dev may use `MAIL_DRIVER=console`, which is refused on Vercel). Optional: `AUTH_TEST_EMAIL` + `AUTH_TEST_CODE`.

## POST /api/auth/request — ask for a code

Request: `{ "email": "Name@Example.com " }`

| Status | Body | When |
|--------|------|------|
| 200 | `{ ok: true, resend_after_s: 60, expires_in_s: 600 }` | A code was issued and mailed (or, for the test account, nothing was mailed). **Identical for every address**, known or unknown |
| 400 | `{ ok: false, error: "invalid_email" }` | Not a plausible address after trim/lower-case |
| 429 | `{ ok: false, error: "rate_limited", retry_after_s: N }` | > 5 requests for the address in the last hour, > 20 from the source, or a request < 60 s after the previous one |
| 502 | `{ ok: false, error: "mail_failed" }` | SMTP refused or timed out; the code row is discarded |
| 503 | `{ ok: false, error: "auth_disabled" }` | `AUTH_PEPPER` not configured |

Effects: older active codes of the address are superseded; a new 6-digit code (10-minute life, 5 attempts) is
stored hashed; one email is sent before the response. The response never depends on whether an account exists.

## POST /api/auth/verify — exchange the code for a session

Request: `{ "email": "...", "code": "123456", "device_id": "dev_<32 hex>" }`

| Status | Body | When |
|--------|------|------|
| 200 | `{ ok: true, token: "<opaque>", email: "name@example.com", created: true\|false }` | Correct code. The account is created if new; the device is linked (a previous open link on this device is closed first); a session is stored |
| 400 | `{ ok: false, error: "invalid_payload" }` | Bad email, code not 6 digits, bad `device_id` |
| 401 | `{ ok: false, error: "wrong_code", attempts_left: N }` | Wrong code for an active code; the attempt is counted |
| 401 | `{ ok: false, error: "code_expired" }` | The newest code has expired |
| 401 | `{ ok: false, error: "too_many_attempts" }` | The 5th wrong attempt was used; a new code is needed |
| 401 | `{ ok: false, error: "no_code" }` | No active code for the address (never requested, used, or superseded) |
| 503 | `{ ok: false, error: "auth_disabled" }` | `AUTH_PEPPER` not configured |

A correct code is accepted **once**. Test account: `AUTH_TEST_EMAIL` + `AUTH_TEST_CODE` both set → that exact
pair returns 200 without any stored code; the same code with another address is `wrong_code`/`no_code`.

## GET /api/auth/me — is this session still valid?

Header: `Authorization: Bearer <token>`

| Status | Body |
|--------|------|
| 200 | `{ ok: true, email: "name@example.com" }` |
| 401 | `{ ok: false, error: "invalid_session" }` (missing, malformed, revoked, or its account was deleted) |

## POST /api/auth/signout — end this session

Header: `Authorization: Bearer <token>`. Revokes the session and closes the device's open link.
**Idempotent**: always `200 { ok: true }`, including for an unknown or already revoked token, so the app can
always clear its local state afterwards.

## DELETE /api/auth/account — delete the account

Header: `Authorization: Bearer <token>`

| Status | Body |
|--------|------|
| 200 | `{ ok: true }` — user, all sessions, all device links and all login codes of the address removed in one transaction |
| 401 | `{ ok: false, error: "invalid_session" }` |
| 502 | `{ ok: false, error: "store_failed" }` — nothing was deleted (transaction rolled back) |

## Unchanged endpoints

`POST /api/attempts`, `POST|GET /api/sync`, `POST /api/subscribe` keep their contracts. Attribution of their
rows to an account is a read-time join (see `data-model.md`).

## Contract tests (server, `node:test` + `app.inject` + in-memory store)

- request: identical body for an address with and without an account; 400 on garbage; 429 on the 6th within
  an hour, on the 21st from one source, and within 60 s; `mail_failed` discards the code; the mailer receives
  exactly one message with a 6-digit code.
- verify: success once, then `no_code`; wrong code decrements `attempts_left`; the 5th wrong attempt kills a
  code that would otherwise be right; expiry via injected clock; a newer request supersedes the old code.
- me / signout / account: bearer parsing, revoked and deleted sessions, idempotent signout, deletion removes
  links (so attribution returns to anonymous).
- test account: enabled only when both env vars are valid; no mail; other addresses unaffected; disabled →
  refused like any wrong code.
- logging: a captured logger never contains the code or the token.
