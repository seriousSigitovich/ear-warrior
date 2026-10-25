// Entry point: bootstrap the schema, then start listening.
import { initSentry, captureException, flushSentry } from './observability.js';
initSentry();

import { buildApp } from './app.js';
import { initDb, sql } from './db/client.js';
import { runCollectors } from './social/collect.js';

const PORT = Number(process.env.PORT ?? 8080);

async function main(): Promise<void> {
  await initDb();
  const app = buildApp();

  const shutdown = async () => {
    await app.close();
    await sql.end({ timeout: 5 });
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Optional in-process scheduler for social analytics. Snapshots are keyed by UTC day, so
  // overlapping or repeated runs are harmless; an external cron hitting the CLI works just as well.
  const everyHours = Number(process.env.SOCIAL_COLLECT_INTERVAL_HOURS ?? 0);
  if (everyHours > 0) {
    const tick = () =>
      runCollectors().catch((err) => {
        captureException(err);
        app.log.error({ err }, 'social collect failed');
      });
    setInterval(tick, everyHours * 3_600_000).unref();
    void tick();
  }

  await app.listen({ port: PORT, host: '0.0.0.0' });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('fatal startup error', err);
  captureException(err);
  void flushSentry().finally(() => process.exit(1));
});
