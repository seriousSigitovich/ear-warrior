// Fastify app assembly. Kept separate from server.ts so it can be imported in tests.
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { registerSubscribe } from './routes/subscribe.js';
import { registerTelemetry } from './routes/telemetry.js';
import { registerSync } from './routes/sync.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
    // Trust the proxy so client IPs/UA are read correctly behind a load balancer.
    trustProxy: true,
  });

  const origin = process.env.CORS_ORIGIN ?? '*';
  app.register(cors, {
    origin: origin === '*' ? true : origin.split(',').map((s) => s.trim()),
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  app.get('/health', async () => ({ ok: true, service: 'ear-warrior-server' }));

  registerSubscribe(app);
  registerTelemetry(app);
  registerSync(app);

  return app;
}
