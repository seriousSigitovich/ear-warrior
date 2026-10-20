# Contract: Client auth (app side)

Pure logic is unit-tested with Jest (node env, no React Native). `.tsx` files only render.

## Modules

| Module | Responsibility | Tested by |
|--------|----------------|-----------|
| `src/lib/email.ts` | `normalizeEmail(s)`, `isPlausibleEmail(s)` — same rule as the server | `tests/unit/lib/email.test.ts` |
| `src/services/auth/client.ts` | `AuthClient { requestCode, verify, me, signOut, deleteAccount }` over `fetch`; `createAuthClient(baseUrl)` returns `null` when `EXPO_PUBLIC_API_URL` is unset (sign-in then hidden — app stays anonymous) | `tests/contract/authClient.test.ts` (mocked fetch) |
| `src/services/auth/flow.ts` | pure state machine, see below; resend-cooldown and attempts-left math over an injected clock | `tests/unit/auth/flow.test.ts` |
| `src/services/auth/messages.ts` | server error code → `{ title, hint }` copy | `tests/unit/auth/messages.test.ts` |
| `src/services/auth/session.ts` | `SessionStore { get, set, clear }`; secure-store adapter required lazily | adapter untested natively; interface used by tests as an in-memory fake |
| `src/features/auth/useAuth.ts` | React hook wiring the above; exposes `state`, `signIn`, `verify`, `signOut`, `deleteAccount`, `onAuthChange(listener)` | manual (quickstart) |

## Auth state (public)

```ts
type AuthState =
  | { status: 'anonymous' }
  | { status: 'signedIn'; email: string };
// onAuthChange(listener: (state: AuthState) => void): () => void
```

Sentry (`setUser`) and the product-events payload subscribe to `onAuthChange`; they are not part of this spec.

## Sign-in flow states (`flow.ts`)

```text
emailEntry --submit(valid email)--> requesting --200--> codeEntry(resendAt, expiresAt)
emailEntry --submit(invalid)------> emailEntry(error: invalid_email)          [no request sent]
requesting --429/502/offline------> emailEntry(error)
codeEntry  --submit(6 digits)-----> verifying --200--> done(email)
codeEntry  --wrong_code-----------> codeEntry(attemptsLeft)
codeEntry  --code_expired / too_many_attempts / no_code--> codeEntry(needsNewCode) → "Send a new code"
codeEntry  --resend (after resendAt)--> requesting
codeEntry  --change email---------> emailEntry (email kept)
any        --Skip / back---------> dismissed   [sets ew.signInOfferSeen]
```

Resend is disabled until `resendAt` (60 s); the screen shows a live countdown. Submit is disabled for a code
that is not 6 digits.

## Error copy (Constitution III: what happened + what to do)

| Server / local code | Title | Hint |
|---------------------|-------|------|
| `invalid_email` (local or 400) | That doesn't look like an email | Check for typos, e.g. `name@gmail.com` |
| `rate_limited` | Too many codes requested | Try again in {N} minutes |
| `mail_failed` | We couldn't send the email | Check your connection and tap "Send again" |
| `wrong_code` | That code isn't right | {n} attempts left — check the latest email |
| `code_expired` | That code has expired | Tap "Send a new code" |
| `too_many_attempts` | Too many wrong tries | Tap "Send a new code" |
| `no_code` | There is no active code for this email | Tap "Send a new code" |
| network error / `auth_disabled` | Can't reach the server | You can keep practising; try signing in later |

## Screens

- **Sign-in** (`app/sign-in.tsx`): `Screen` + `Kicker` "Sign in" + email field → code field (6 digits, numeric
  keypad, one-time-code autofill hint) + primary `Button` + visible **Skip** (one tap). Copy explains why:
  "Sign in so we can reach out about your feedback. Practice works without it."
- **Settings → Account** (`app/settings.tsx`): signed out → "Sign in with email"; signed in → the email,
  "Sign out", and "Delete account". Sign out and Delete each open a confirmation; Delete states that the email
  and its link to your usage data are removed and that practice history on this phone stays.
- **First-launch offer**: shown once (flag `ew.signInOfferSeen`) by the onboarding work when it lands; until
  then, once from Home. Always dismissible.

## Accessibility (spec 004 baseline, FR-020)

Every control has an accessible label and role; touch targets ≥ 48 dp; text/icon contrast ≥ 4.5:1 using
`theme/nocturne.ts` tokens; error text is announced (`accessibilityLiveRegion`); layouts checked at the
largest OS font size. The countdown is announced at start and when resend becomes available, not every second.

## Lifecycle rules

- On app start and on return from background after > 1 hour, with a token and a network: call `me()`;
  `invalid_session` → clear the token and become `anonymous`. Offline: stay as is, never block.
- `signOut()`: call the server (ignore failures), then always clear the token, `ew.lastEmail`, and emit
  `anonymous`.
- `deleteAccount()`: on server `200` clear everything as for sign-out; on failure keep the session and show
  the error (nothing deleted).
- The practice loop, sync and the attempt outbox **do not read** the auth state (R15).
