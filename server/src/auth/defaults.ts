// Production wiring of the auth routes: Postgres store, SMTP mailer, real clock, env config.
// The mailer is built on first use, so a deploy without SMTP settings still serves everything else.
import { db } from '../db/client.js';
import { authConfigFromEnv, type AuthDeps } from '../routes/auth.js';
import { mailerFromEnv, type Mailer } from './mailer.js';
import { createPgStore } from './pgStore.js';

export function defaultAuthDeps(): AuthDeps {
  let mailer: Mailer | undefined;
  return {
    store: createPgStore(db),
    mailer: {
      sendCode: (to, code) => (mailer ??= mailerFromEnv()).sendCode(to, code),
    },
    now: () => new Date(),
    config: () => authConfigFromEnv(),
  };
}
