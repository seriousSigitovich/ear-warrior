// Optional email sign-in (spec 005): POST /api/auth/request, POST /api/auth/verify, GET /api/auth/me,
// POST /api/auth/signout, DELETE /api/auth/account. Contract: specs/005-user-auth/contracts/auth-api.md.
//
// Everything with IO arrives through `deps` (store, mailer, clock, config), so every rule here is testable
// with an in-memory store. Secrets — the code, the token, request bodies — are never logged (FR-022).
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { generateCode, hashCode, matchesHash } from '../auth/codes.js';
import { isPlausibleEmail, normalizeEmail } from '../auth/email.js';
import { decideRequest } from '../auth/limits.js';
import type { Mailer } from '../auth/mailer.js';
import { CODE_RETENTION_S, CODE_TTL_S, MAX_ATTEMPTS, RESEND_AFTER_S, WINDOW_S } from '../auth/policy.js';
import type { AuthStore } from '../auth/store.js';
import { generateToken, hashToken, parseBearer } from '../auth/tokens.js';

export interface AuthConfig {
  /** Secret mixed into code and source hashes. Without it the routes answer 503. */
  pepper?: string;
  /** Reviewer test account (R9): active only when both are set. */
  testEmail?: string;
  testCode?: string;
}

export interface AuthDeps {
  store: AuthStore;
  mailer: Mailer;
  now: () => Date;
  /** Read per request, so the test account can be switched by env without a rebuild. */
  config: () => AuthConfig;
  /** Source of the 6-digit number; defaults to a CSPRNG. Tests pin it. */
  randomCode?: () => number;
}

export function authConfigFromEnv(env: Record<string, string | undefined> = process.env): AuthConfig {
  const testOn = Boolean(env.AUTH_TEST_EMAIL) && /^[0-9]{6}$/.test(env.AUTH_TEST_CODE ?? '');
  return {
    pepper: env.AUTH_PEPPER || undefined,
    testEmail: testOn ? normalizeEmail(env.AUTH_TEST_EMAIL as string) : undefined,
    testCode: testOn ? env.AUTH_TEST_CODE : undefined,
  };
}

const RequestBody = z.object({ email: z.string() });
const VerifyBody = z.object({
  email: z.string(),
  code: z.string().regex(/^[0-9]{6}$/),
  device_id: z.string().min(1).max(80),
});

/** Equal-length digests make the comparison constant-time whatever the inputs. */
const sameSecret = (a: string, b: string, key: string): boolean =>
  timingSafeEqual(createHmac('sha256', key).update(a).digest(), createHmac('sha256', key).update(b).digest());

export function registerAuth(app: FastifyInstance, deps: AuthDeps): void {
  const { store, mailer, now } = deps;

  const disabled = (reply: FastifyReply) => reply.status(503).send({ ok: false, error: 'auth_disabled' });
  const invalidSession = (reply: FastifyReply) => reply.status(401).send({ ok: false, error: 'invalid_session' });

  /** The live session behind `Authorization: Bearer`, or null. */
  async function sessionOf(req: FastifyRequest) {
    const token = parseBearer(req.headers.authorization);
    return token ? { token, info: await store.sessionByToken(hashToken(token)) } : { token: null, info: null };
  }

  app.post('/api/auth/request', async (req, reply) => {
    const { pepper, testEmail } = deps.config();
    if (!pepper) return disabled(reply);

    const parsed = RequestBody.safeParse(req.body ?? {});
    const email = parsed.success ? normalizeEmail(parsed.data.email) : '';
    if (!isPlausibleEmail(email)) return reply.status(400).send({ ok: false, error: 'invalid_email' });

    const accepted = { ok: true, resend_after_s: RESEND_AFTER_S, expires_in_s: CODE_TTL_S };
    // The reviewer's address gets the usual answer but no code and no mail.
    if (testEmail && email === testEmail) return accepted;

    const t = now();
    const sourceHash = hashCode(req.ip, pepper);
    await store.purgeCodesBefore(new Date(t.getTime() - CODE_RETENTION_S * 1000));
    const recent = await store.requestTimes(email, sourceHash, new Date(t.getTime() - WINDOW_S * 1000));
    const decision = decideRequest({ emailRequests: recent.email, sourceRequests: recent.source, now: t });
    if (!decision.allow) {
      return reply.status(429).send({ ok: false, error: 'rate_limited', retry_after_s: decision.retryAfterS });
    }

    const code = generateCode(deps.randomCode);
    const id = await store.issueCode({
      email,
      codeHash: hashCode(code, pepper),
      sourceHash,
      now: t,
      expiresAt: new Date(t.getTime() + CODE_TTL_S * 1000),
    });
    try {
      // Awaited before replying: a serverless function may be frozen the moment it responds.
      await mailer.sendCode(email, code);
    } catch (err) {
      req.log.error({ err: (err as Error).message }, 'sign-in mail failed');
      await store.discardCode(id);
      return reply.status(502).send({ ok: false, error: 'mail_failed' });
    }
    return accepted;
  });

  app.post('/api/auth/verify', async (req, reply) => {
    const { pepper, testEmail, testCode } = deps.config();
    if (!pepper) return disabled(reply);

    const parsed = VerifyBody.safeParse(req.body ?? {});
    const email = parsed.success ? normalizeEmail(parsed.data.email) : '';
    if (!parsed.success || !isPlausibleEmail(email)) return reply.status(400).send({ ok: false, error: 'invalid_payload' });
    const { code, device_id: deviceId } = parsed.data;

    const isTestPair = Boolean(testEmail && testCode) && email === testEmail && sameSecret(code, testCode as string, pepper);
    if (!isTestPair) {
      const row = await store.latestCode(email);
      if (!row || row.usedAt || row.supersededAt) return reply.status(401).send({ ok: false, error: 'no_code' });
      if (row.attempts >= MAX_ATTEMPTS) return reply.status(401).send({ ok: false, error: 'too_many_attempts' });
      if (row.expiresAt <= now()) return reply.status(401).send({ ok: false, error: 'code_expired' });

      // Count the try before comparing, atomically: parallel guesses cannot exceed the limit.
      const attempts = await store.takeAttempt(row.id, MAX_ATTEMPTS);
      if (attempts === null) return reply.status(401).send({ ok: false, error: 'too_many_attempts' });
      if (!matchesHash(code, pepper, row.codeHash)) {
        return attempts >= MAX_ATTEMPTS
          ? reply.status(401).send({ ok: false, error: 'too_many_attempts' })
          : reply.status(401).send({ ok: false, error: 'wrong_code', attempts_left: MAX_ATTEMPTS - attempts });
      }
      if (!(await store.consumeCode(row.id, now()))) return reply.status(401).send({ ok: false, error: 'no_code' });
    }

    const token = generateToken();
    const { created } = await store.signIn({ email, deviceId, tokenHash: hashToken(token), now: now() });
    return { ok: true, token, email, created };
  });

  app.get('/api/auth/me', async (req, reply) => {
    const { info } = await sessionOf(req);
    return info ? { ok: true, email: info.email } : invalidSession(reply);
  });

  // Idempotent: the app always clears its own state afterwards, so an unknown token is not an error.
  app.post('/api/auth/signout', async (req, reply) => {
    const token = parseBearer(req.headers.authorization);
    if (token) {
      try {
        await store.signOut(hashToken(token), now());
      } catch (err) {
        req.log.error({ err: (err as Error).message }, 'sign-out failed');
        return reply.status(502).send({ ok: false, error: 'store_failed' });
      }
    }
    return { ok: true };
  });

  app.delete('/api/auth/account', async (req, reply) => {
    const { info } = await sessionOf(req);
    if (!info) return invalidSession(reply);
    try {
      await store.deleteUser(info.userId);
    } catch (err) {
      req.log.error({ err: (err as Error).message }, 'account deletion failed');
      return reply.status(502).send({ ok: false, error: 'store_failed' });
    }
    return { ok: true };
  });
}
