// Vercel serverless entry. Vercel runs this file as a function; the Fastify app (compiled to dist/ by
// `npm run build`) is built once per warm instance and every request is handed to it.
// The schema bootstrap (idempotent DDL) runs lazily before the first request that needs the database,
// so /health answers even when no database is configured yet.
import { initSentry, captureException, flushSentry } from '../dist/observability.js';
import { buildApp } from '../dist/app.js';
import { initDb } from '../dist/db/client.js';

initSentry();

let schemaReady;
const ensureSchema = () => {
  schemaReady ??= initDb().catch((err) => {
    schemaReady = undefined; // retry on the next request instead of caching the failure
    throw err;
  });
  return schemaReady;
};

let appPromise;
const getApp = () => {
  appPromise ??= (async () => {
    const app = buildApp();
    app.addHook('onRequest', async (req) => {
      if (req.url !== '/health') await ensureSchema();
    });
    await app.ready();
    return app;
  })();
  return appPromise;
};

export default async function handler(req, res) {
  try {
    const app = await getApp();
    res.once('close', () => void flushSentry()); // the function freezes once the response is done
    app.server.emit('request', req, res);
  } catch (err) {
    captureException(err);
    await flushSentry();
    throw err;
  }
}
