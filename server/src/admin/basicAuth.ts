// HTTP Basic gate shared by the owner pages (/admin/social, /admin/users). With no ADMIN_PASSWORD
// configured the pages answer 404, so a fresh deploy never exposes them by accident.
import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

const sha = (s: string): Buffer => createHash('sha256').update(s).digest();
export const safeEqual = (a: string, b: string): boolean => timingSafeEqual(sha(a), sha(b));

/** Returns true if the request may proceed; otherwise it has already replied. */
export function authorize(req: FastifyRequest, reply: FastifyReply): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    void reply.status(404).send({ ok: false, error: 'not_found' });
    return false;
  }
  const user = process.env.ADMIN_USER ?? 'admin';
  const header = req.headers.authorization ?? '';
  if (header.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const i = decoded.indexOf(':');
    if (i > 0 && safeEqual(decoded.slice(0, i), user) && safeEqual(decoded.slice(i + 1), password)) return true;
  }
  void reply.header('www-authenticate', 'Basic realm="ear-warrior admin", charset="UTF-8"').status(401).send('Authentication required');
  return false;
}
