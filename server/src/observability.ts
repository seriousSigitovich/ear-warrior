// Error reporting (Sentry). Inert without SENTRY_DSN, so dev and tests send nothing.
import * as Sentry from '@sentry/node';

export function initSentry(): void {
  if (!process.env.SENTRY_DSN || Sentry.getClient()) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'production',
    tracesSampleRate: 0,
  });
}

/** Serverless functions freeze right after responding, so queued events must be sent before that. */
export const flushSentry = (): Promise<boolean> => Sentry.flush(2000);

export const captureException = Sentry.captureException;
export const setupFastifyErrorHandler = Sentry.setupFastifyErrorHandler;
