// Entry point: bootstrap the schema, then start listening.
import { buildApp } from './app.js';
import { initDb, sql } from './db/client.js';

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

  await app.listen({ port: PORT, host: '0.0.0.0' });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('fatal startup error', err);
  process.exit(1);
});
