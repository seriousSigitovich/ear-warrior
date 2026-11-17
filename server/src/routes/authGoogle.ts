// Optional Google sign-in (spec 022): GET /api/auth/providers, POST /api/auth/google/start,
// GET /api/auth/google/callback, POST /api/auth/google/exchange. Contract: specs/022-google-sign-in/contracts/google-auth-api.md.
//
// The identity is the Google-verified email; the account, session and device link come from the same
// store.signIn the email code uses, so both methods open one account. Secrets (ticket, verifier, `code`,
// `state`, tokens) are never logged: nothing below passes them to a logger, and app.ts strips the callback query.
import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { exchangeGoogleCode } from '../auth/googleIdentity.js';
import { returnPage, type ReturnOutcome } from '../auth/googlePage.js';
import { challengeOf, newVerifier, signState, verifyState } from '../auth/googleState.js';
import { generateToken, hashToken } from '../auth/tokens.js';
import { mergeAfterSignIn, type AuthDeps } from './auth.js';

const TICKET_TTL_S = 2 * 60;
const TICKET_RETENTION_S = 24 * 60 * 60;
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

const ExchangeBody = z.object({
  ticket: z.string().min(20).max(100),
  verifier: z.string().min(43).max(128),
  device_id: z.string().min(1).max(80),
});

export function registerAuthGoogle(app: FastifyInstance, deps: AuthDeps): void {
  const { store, now } = deps;
  const fetchImpl = deps.fetch ?? fetch;

  /** Google sign-in works only with the OAuth client and the secret that signs `state`. */
  const ready = () => {
    const pepper = deps.config().pepper;
    const google = deps.google?.();
    return pepper && google ? { pepper, google } : null;
  };
  const disabled = (reply: FastifyReply) => reply.status(503).send({ ok: false, error: 'google_disabled' });
  const page = (reply: FastifyReply, outcome: ReturnOutcome) =>
    reply.status(200).header('Content-Type', 'text/html; charset=utf-8').header('Cache-Control', 'no-store').header('Referrer-Policy', 'no-referrer').send(returnPage(outcome));

  app.get('/api/auth/providers', async () => ({ ok: true, email: true, google: ready() !== null }));

  app.post('/api/auth/google/start', async (_req, reply) => {
    const cfg = ready();
    if (!cfg) return disabled(reply);
    const verifier = newVerifier();
    const url = new URL(AUTH_URL);
    url.search = new URLSearchParams({
      client_id: cfg.google.clientId,
      redirect_uri: cfg.google.redirectUri,
      response_type: 'code',
      scope: 'openid email',
      prompt: 'select_account',
      state: signState(challengeOf(verifier), cfg.pepper, now()),
    }).toString();
    return { ok: true, url: url.toString(), verifier };
  });

  app.get('/api/auth/google/callback', async (req, reply) => {
    const cfg = ready();
    if (!cfg) return page(reply, { error: 'google_disabled' });
    const q = req.query as { code?: unknown; state?: unknown; error?: unknown };

    const challenge = typeof q.state === 'string' ? verifyState(q.state, cfg.pepper, now()) : null;
    if (!challenge) return page(reply, { error: 'expired' });
    if (typeof q.error === 'string') return page(reply, { error: q.error === 'access_denied' ? 'cancelled' : 'google_failed' });
    if (typeof q.code !== 'string' || q.code.length === 0 || q.code.length > 2048) return page(reply, { error: 'google_failed' });

    const identity = await exchangeGoogleCode({ code: q.code, config: cfg.google, fetch: fetchImpl, now: now() });
    if (!identity.ok) return page(reply, { error: identity.reason });

    const t = now();
    const ticket = randomBytes(32).toString('base64url');
    try {
      await store.purgeGoogleTicketsBefore(new Date(t.getTime() - TICKET_RETENTION_S * 1000));
      await store.issueGoogleTicket({
        ticketHash: hashToken(ticket),
        email: identity.email,
        challenge,
        now: t,
        expiresAt: new Date(t.getTime() + TICKET_TTL_S * 1000),
      });
    } catch (err) {
      req.log.error({ err: (err as Error).message }, 'google ticket store failed');
      return page(reply, { error: 'google_failed' });
    }
    return page(reply, { ticket });
  });

  app.post('/api/auth/google/exchange', async (req, reply) => {
    const cfg = ready();
    if (!cfg) return disabled(reply);
    const parsed = ExchangeBody.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ ok: false, error: 'invalid_payload' });
    const { ticket, verifier, device_id: deviceId } = parsed.data;

    // Taking the ticket burns it: a wrong verifier gets exactly one try (R9).
    const taken = await store.takeGoogleTicket(hashToken(ticket), now());
    if (!taken || challengeOf(verifier) !== taken.challenge) return reply.status(401).send({ ok: false, error: 'invalid_ticket' });

    const token = generateToken();
    const { userId, created } = await store.signIn({ email: taken.email, deviceId, tokenHash: hashToken(token), now: now() });
    const merged = await mergeAfterSignIn(req, deps, deviceId, userId);
    return { ok: true, token, email: taken.email, created, merged };
  });
}
