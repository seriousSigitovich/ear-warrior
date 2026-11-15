# Contract: Google sign-in HTTP API

Base URL: `https://ear-warrior-api.vercel.app`. Extends [spec 005 auth-api.md](../../005-user-auth/contracts/auth-api.md); error bodies and the
bearer session are identical. **Never logged**: the ticket, the verifier, the `code` and `state` query parameters, the Google token response,
the session token.

Server env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_PEPPER`; optional `PUBLIC_API_URL`. Redirect URI to register at Google:
`<PUBLIC_API_URL>/api/auth/google/callback`.

## GET /api/auth/providers

| Status | Body |
|--------|------|
| 200 | `{ ok: true, email: true, google: boolean }` — `google` is true only when the three env values are set |

## POST /api/auth/google/start

Request: empty body.

| Status | Body | When |
|--------|------|------|
| 200 | `{ ok: true, url: "https://accounts.google.com/o/oauth2/v2/auth?client_id&redirect_uri&response_type=code&scope=openid%20email&prompt=select_account&state=<signed>", verifier: "<43 char b64url>" }` | Google configured. The app opens `url` in the browser and keeps `verifier` until the return |
| 503 | `{ ok: false, error: "google_disabled" }` | Not configured |

The verifier is 32 CSPRNG bytes; the state signs only its SHA-256 (R2). Nothing is stored.

## GET /api/auth/google/callback?code=…&state=… (or `?error=…&state=…`)

Always answers `200 text/html` (the return page, R4), never JSON. The page's button/auto-link is one of:

| Deep link | When |
|-----------|------|
| `earwarrior://sign-in?ticket=<ticket>` | State valid, Google exchange succeeded, id-token claims valid (`iss`, `aud`, `exp`, `email_verified = true`). A ticket row is stored |
| `earwarrior://sign-in?error=cancelled` | Google returned `error=access_denied` |
| `earwarrior://sign-in?error=unverified_email` | Token valid but `email_verified` is not true |
| `earwarrior://sign-in?error=expired` | `state` missing, altered or older than 10 min |
| `earwarrior://sign-in?error=google_failed` | Token endpoint refused, unreachable, or claims invalid (audience/issuer/expiry) |
| `earwarrior://sign-in?error=google_disabled` | Not configured |

The page text for errors is plain language with a "Back to Ear Warrior" button (Constitution III).

## POST /api/auth/google/exchange — trade the ticket for a session

Request: `{ "ticket": "<ticket>", "verifier": "<43–128 char b64url>", "device_id": "dev_<32 hex>" }`

| Status | Body | When |
|--------|------|------|
| 200 | `{ ok: true, token, email, created: true\|false }` — same shape as `verify` | Ticket active and `SHA-256(verifier) == challenge`; the account is found or created by email, the device linked (previous link on this device closed), a session stored |
| 400 | `{ ok: false, error: "invalid_payload" }` | Malformed ticket, verifier or device_id |
| 401 | `{ ok: false, error: "invalid_ticket" }` | Unknown, expired, already used, or verifier mismatch (the ticket is burned by the attempt; indistinguishable cases) |
| 503 | `{ ok: false, error: "google_disabled" }` | Not configured |

`/api/auth/me`, `/signout`, `DELETE /account` are unchanged and work for these sessions.

## Contract tests (server, `node:test` + `app.inject` + in-memory store + fake Google fetch)

- providers: `google` false without env, true with env.
- start: 200 with a Google URL carrying `prompt=select_account`, scope `openid email`, a signed state, and a fresh verifier each time whose hash is the state's challenge (the verifier itself appears nowhere in the URL); 503 unconfigured.
- callback: happy path → ticket in the page and in the store; altered/expired state → `expired`; `access_denied` → `cancelled`; `email_verified:false` → `unverified_email`; wrong `aud`/`iss`/expired token → `google_failed`; Google down → `google_failed`; the page never contains the Google tokens.
- exchange: success once, then `invalid_ticket`; wrong verifier → `invalid_ticket` and the ticket is burned; expired ticket by injected clock; same address created by email code first → same user, `created:false` (FR-005, SC-004); the reverse order; two devices; deleted account → new account.
- logging: a captured logger never contains the ticket, verifier, state, code or token.
