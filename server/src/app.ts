// Fastify app assembly. Kept separate from server.ts so it can be imported in tests.
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import { registerSubscribe } from './routes/subscribe.js';
import { registerTelemetry } from './routes/telemetry.js';
import { registerSync } from './routes/sync.js';
import { registerSocial } from './routes/social.js';
import { registerAuth, type AuthDeps } from './routes/auth.js';
import { registerUsers } from './routes/users.js';
import { defaultAuthDeps } from './auth/defaults.js';
import { loadUsageReport } from './auth/usage.js';
import type { UsageReport } from './auth/usagePage.js';
import { setupFastifyErrorHandler } from './observability.js';

export interface BuildOptions {
  /** Replaces the production auth wiring (tests pass an in-memory store and a recording mailer). */
  auth?: AuthDeps;
  /** Replaces the Postgres read behind /admin/users (tests). */
  usage?: (now: Date) => Promise<UsageReport>;
  logger?: FastifyServerOptions['logger'];
}

export function buildApp(opts: BuildOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: opts.logger ?? true,
    // Trust the proxy so client IPs/UA are read correctly behind a load balancer.
    trustProxy: true,
  });

  setupFastifyErrorHandler(app); // reports unhandled route errors (5xx) when Sentry is configured

  const origin = process.env.CORS_ORIGIN ?? '*';
  app.register(cors, {
    origin: origin === '*' ? true : origin.split(',').map((s) => s.trim()),
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  });

  app.get('/health', async () => ({ ok: true, service: 'ear-warrior-server' }));

  registerSubscribe(app);
  registerTelemetry(app);
  registerSync(app);
  registerSocial(app);
  registerAuth(app, opts.auth ?? defaultAuthDeps());
  registerUsers(app, opts.usage ?? loadUsageReport);

  return app;
}
