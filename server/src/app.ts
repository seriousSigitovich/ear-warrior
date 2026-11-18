// Fastify app assembly. Kept separate from server.ts so it can be imported in tests.
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import { registerSubscribe } from './routes/subscribe.js';
import { registerTelemetry } from './routes/telemetry.js';
import { registerEvents } from './routes/events.js';
import { registerProgress } from './routes/progress.js';
import { registerChallenges, type ChallengesDeps } from './routes/challenges.js';
import { registerAdminChallenges } from './routes/adminChallenges.js';
import { createPgChallengeStore } from './challenges/pgStore.js';
import type { ChallengeStore } from './challenges/override.js';
import { registerSocial } from './routes/social.js';
import { registerAuth, type AuthDeps } from './routes/auth.js';
import { registerAuthGoogle } from './routes/authGoogle.js';
import { registerAnalytics } from './routes/analytics.js';
import { registerAdminIndex } from './admin/indexPage.js';
import { registerMelodies } from './routes/melodies.js';
import { registerPhrase } from './routes/phrase.js';
import { registerAdminRecompute } from './routes/adminRecompute.js';
import { createPgLedgerStore } from './progress/ledgerPgStore.js';
import { mergeAnonymous } from './progress/mergeAnonymous.js';
import type { LedgerStore } from './progress/ledger.js';
import { blobTuneUploader, registerAdminTunes, type TuneAudioUploader } from './routes/adminTunes.js';
import { createPgTuneStore } from './tunes/pgStore.js';
import type { TuneStore } from './tunes/store.js';
import { defaultAuthDeps } from './auth/defaults.js';
import { createPgProgressStore } from './progress/pgStore.js';
import type { ProgressStore } from './progress/store.js';
import { db } from './db/client.js';
import { loadAnalytics } from './analytics/report.js';
import type { AnalyticsData } from './analytics/model.js';
import { setupFastifyErrorHandler } from './observability.js';

export interface BuildOptions {
  /** Replaces the production auth wiring (tests pass an in-memory store and a recording mailer). */
  auth?: AuthDeps;
  /** Replaces the Postgres store behind /api/progress/* (tests pass an in-memory one). */
  progress?: ProgressStore;
  /** Overrides for /api/challenges/today (tests pass a fixed clock). */
  challenges?: ChallengesDeps;
  /** Replaces the Postgres store of the owner's manual challenge days (tests pass an in-memory one). */
  challengeStore?: ChallengeStore;
  /** Replaces the Postgres melody library behind /api/melodies (tests pass an in-memory one). */
  tunes?: TuneStore;
  /** Replaces the Postgres XP ledger behind /api/progress/phrase (tests pass an in-memory one). */
  ledger?: LedgerStore;
  /** Replaces the Vercel Blob upload of tune audio (tests). */
  tuneAudio?: TuneAudioUploader;
  /** Clock of the admin tune calls (tests). */
  now?: () => Date;
  /** Replaces the Postgres read behind /admin/analytics (tests). */
  analytics?: () => Promise<AnalyticsData>;
  logger?: FastifyServerOptions['logger'];
}

/** Request logs carry the URL; on the Google callback its query holds the one-time `code` and `state` (spec 022 FR-016). */
function withRedactedCallbackQuery(logger: BuildOptions['logger']): FastifyServerOptions['logger'] {
  if (logger === false) return false;
  const base = logger === true || logger === undefined ? {} : (logger as Record<string, unknown>);
  const serializers = (base.serializers ?? {}) as Record<string, unknown>;
  return {
    ...base,
    serializers: {
      ...serializers,
      req: (req: { method?: string; url?: string; host?: string; ip?: string; socket?: { remotePort?: number } }) => ({
        method: req.method,
        url: req.url?.startsWith('/api/auth/google/') ? req.url.split('?')[0] : req.url,
        host: req.host,
        remoteAddress: req.ip,
        remotePort: req.socket?.remotePort,
      }),
    },
  } as FastifyServerOptions['logger'];
}

export function buildApp(opts: BuildOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: withRedactedCallbackQuery(opts.logger),
    // Trust the proxy so client IPs/UA are read correctly behind a load balancer.
    trustProxy: true,
  });

  setupFastifyErrorHandler(app); // reports unhandled route errors (5xx) when Sentry is configured

  const origin = process.env.CORS_ORIGIN ?? '*';
  app.register(cors, {
    origin: origin === '*' ? true : origin.split(',').map((s) => s.trim()),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.get('/health', async () => ({ ok: true, service: 'ear-warrior-server' }));

  registerSubscribe(app);
  registerTelemetry(app);
  registerEvents(app);
  registerSocial(app);
  const ledger = opts.ledger ?? createPgLedgerStore(db);
  const baseAuth = opts.auth ?? defaultAuthDeps();
  // Spec 024: signing in folds the device's anonymous identity (and its XP) into the account.
  const auth = { ...baseAuth, afterSignIn: baseAuth.afterSignIn ?? ((deviceId: string, userId: string) => mergeAnonymous(baseAuth.store, ledger, deviceId, userId)) };
  registerAuth(app, auth);
  registerAuthGoogle(app, auth);
  const progress = opts.progress ?? createPgProgressStore(db);
  registerProgress(app, { auth: auth.store, progress });
  const challengeStore = opts.challengeStore ?? createPgChallengeStore(db);
  registerChallenges(app, { ...opts.challenges, store: challengeStore });
  registerAdminChallenges(app, challengeStore, opts.challenges?.now);
  const tuneStore = opts.tunes ?? createPgTuneStore(db);
  registerMelodies(app, tuneStore);
  registerPhrase(app, {
    auth: auth.store,
    tunes: tuneStore,
    ledger,
    challenges: challengeStore,
    now: opts.now,
  });
  registerAdminTunes(app, tuneStore, opts.tuneAudio ?? blobTuneUploader, opts.now);
  registerAdminRecompute(app, { progress, tunes: tuneStore, ledger, now: opts.now });
  registerAnalytics(app, opts.analytics ?? loadAnalytics);
  registerAdminIndex(app);

  return app;
}
