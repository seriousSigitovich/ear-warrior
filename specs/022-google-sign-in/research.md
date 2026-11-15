# Research: Optional Google Sign-In

All items resolved; no open NEEDS CLARIFICATION. Dates: 2026-11-15.

## R1 — How the app talks to Google: server-mediated browser flow, not a native SDK

**Decision**: Authorization-code flow with PKCE-style binding, mediated by our own server. The app asks `POST /api/auth/google/start` for a sign-in link and a secret **verifier**, opens the link in the system browser; the link leads to Google (`prompt=select_account`, scopes `openid email`); Google returns to
`GET /api/auth/google/callback`; the server swaps the code for the identity at Google's token endpoint, issues a one-time **ticket**
and sends the learner back with the deep link `earwarrior://sign-in?ticket=…`; the app trades the ticket plus its secret verifier
for a session at `POST /api/auth/google/exchange`.

**Rationale**:
- **No new native module → ships by OTA** (`eas update`, as for spec 021) to the testers on versionCode 2 today. Linking (`Linking.openURL`, expo-router deep links, scheme `earwarrior` already in `app.config.ts`) is already in the binary.
- **No SHA-1 / Play App Signing dependency.** A native Android client is registered by package + signing-certificate fingerprint; the open item in `docs/beta-checklist.md` would block on Play Console. A Web client needs only a redirect URL.
- **The identity never passes through the app.** FR-007 ("the app MUST NOT be trusted to state who the learner is") is satisfied structurally: the server receives the email from Google over TLS itself, authenticated with its client secret.
- Free and without a third-party RN module to track against Expo 57.

**Alternatives considered**:
- `@react-native-google-signin/google-signin`: the free "Original" API sits on Google's deprecated sign-in stack and the maintained "Universal" API is a paid tier; needs a native rebuild (new AAB through review) and the SHA-1. Better UX (in-app sheet) but blocks on three things we do not control quickly. **Kept as the upgrade path**: the server verification in R3 would accept a native ID token too with one more route; nothing here forecloses it.
- `expo-auth-session` + `expo-web-browser`: Expo-maintained, but `expo-web-browser` is a native module (not in the current binary) → forces the same rebuild, and it still needs a client registration on a custom scheme.
- Firebase Auth: a whole new dependency and data processor for one button; rejected by Constitution I (YAGNI).

**Cost accepted**: the account picker opens in the browser, not as a sheet (≈ 4 taps; SC-001 was set accordingly). Whether the browser may leave the app by a custom-scheme link (R4) is verified on a real phone before release (quickstart §5).

## R2 — State, replay and interception protection

**Decision**:
- `start` makes the secret **on the server** (32 CSPRNG bytes, the *verifier*) and returns it to the app over TLS in the JSON body; the app has no CSPRNG of its own (`Math.random` only; `expo-crypto` is a native module that would force a rebuild). The server wraps `{challenge = base64url(SHA-256(verifier)), exp}` into the OAuth `state` parameter as `payload.HMAC-SHA256(payload, AUTH_PEPPER)` — stateless, so serverless instances need no shared memory — and Google echoes it back. The verifier is never put in a URL; it travels only in the `start` response and the `exchange` request bodies. The callback rejects a missing, altered or expired state (10 minutes).
- After a successful Google exchange the server stores a **ticket** (random, 32 bytes; only its SHA-256 is kept) with the verified email and the challenge, valid 2 minutes, usable once.
- `exchange` requires the ticket **and** the verifier: `SHA-256(verifier) == challenge`. Another app that registers the `earwarrior://` scheme and steals the ticket cannot use it without the verifier, which never leaves the device (it is stored in the SQLite key-value table until used).

**Rationale**: custom URL schemes on Android are not exclusive; PKCE is the standard answer (RFC 7636 / RFC 8252 §8.1). Using the same shape as the email code (short-lived, single-use, hashed at rest) keeps one mental model.

**Alternatives**: Android App Links on `earwarrior.app` (exclusive, no PKCE needed) — require `assetlinks.json` with the signing SHA-256, i.e. the same Play Console dependency we avoid. Rejected for now.

## R3 — Verifying the identity

**Decision**: The ID token is taken **from Google's token endpoint response**, fetched by the server over TLS with `client_secret`, and its claims are validated: `iss ∈ {https://accounts.google.com, accounts.google.com}`, `aud == GOOGLE_CLIENT_ID`, `exp` in the future, `email` present, `email_verified === true`. Signature verification is skipped because the token comes straight from Google over an authenticated channel (Google's documented exception); no JWT/JWKS library is added.

**Rationale**: removes a dependency and the JWKS-caching problem on stateless instances, and the trust is the same as for any other Google API response. If a later native route accepts tokens from the device, that route must verify the signature (`jose` + Google JWKS) — noted, not built.

**Identity key**: the normalised email, not Google's `sub` (Google's guidance prefers `sub`, but FR-005 requires one account per address across both methods). Risk: a Google address whose ownership changed hands (e.g. an expired Workspace domain) could sign into the old account. Mitigated by requiring `email_verified`; accepted for a closed beta with ~14 personally known testers, and recorded as an open risk for public release.

## R4 — Returning from the browser to the app

**Decision**: the callback answers with a small HTML page ("Signed in — return to Ear Warrior") carrying an `<a href="earwarrior://sign-in?ticket=…">` button, and also tries the link automatically with a short script. On a failure it links with `?error=<code>` instead.

**Rationale**: Chrome on Android may block a custom-scheme redirect that follows a cross-site redirect chain without a user gesture; a visible button always works, the auto-attempt makes it seamless where allowed. The page contains no personal data except the one-time ticket in the link.

**Alternatives**: a bare `302` to the custom scheme (blocked in some browsers); Custom Tabs via `expo-web-browser` (native, R1).

## R5 — App state across the browser round-trip

The app may be killed while the learner is in the browser. The verifier is therefore persisted (SQLite key-value table, already used for the pending email code) before opening the browser and consumed on return. On a return without a stored verifier, or with an expired one (10 min), the screen shows "That sign-in expired, try again". A ticket arrives at the existing `sign-in` route through expo-router's deep-link query params; the route consumes it once.

## R6 — Showing the button only when it can work (FR-014)

**Decision**: `GET /api/auth/providers` → `{ ok, google: boolean }`; `google` is true when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` and `AUTH_PEPPER` are set. The sign-in screen fetches it on open and hides the button on `false` or on any failure. Older installs never call it and never show the button.

## R7 — Where the Google-side setup lives (owner step)

**Decision**: create a **separate Google Cloud project** for sign-in (consent screen External, scopes `openid` and `email` only, published to Production — non-sensitive scopes need no Google review), and in it one **Web** OAuth client whose authorised redirect URI is `https://ear-warrior-api.vercel.app/api/auth/google/callback`.

**Rationale**: the existing project holds the YouTube/Analytics client (sensitive scopes, unaudited, `docs`/spec 007). Publishing *its* consent screen to Production would trigger Google's verification; a separate project keeps sign-in independent of that audit. In "Testing" status a consent screen caps at 100 named test users and shows a warning — acceptable for the beta only as a stop-gap, so the quickstart says to publish.

## R8 — Method not stored; privacy copy

Identity is the email (R3); we do not record which method created the account (no column, no new personal data). The privacy page and Play Data Safety only gain the sentence that Google sign-in supplies the email address and nothing else (FR-018).

## R9 — Rate limiting and abuse

`start` has no side effects (no storage; it only signs). `callback` is gated by a valid HMAC state, so only flows we started reach Google's token endpoint. `exchange` is gated by an unguessable single-use ticket (≥ 256 bits) and a verifier; a wrong verifier does not consume the ticket's single use but counts as a failed attempt after which the ticket is burned (1 try) — the legitimate app only ever calls once. Source-level limits of spec 005 are not extended to Google (nothing to enumerate: no response depends on whether an account exists).
