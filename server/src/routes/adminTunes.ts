// Owner calls for the melody library (spec 024), behind the same Basic auth as the other /admin pages:
//   GET    /admin/tunes             the page (list, new tune, audio upload)
//   GET    /admin/tunes.json        every tune, answer notes included
//   POST   /admin/tunes/:id         create or change fields (JSON); 422 with the failing rules
//   PUT    /admin/tunes/:id/audio   raw m4a body; stores it, records url + size + sha256 (?show=1 shows the tune)
//   POST   /admin/tunes/:id/show|hide
//   DELETE /admin/tunes/:id         XP already paid for its phrases stays in the ledger
import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authorize } from '../admin/basicAuth.js';
import { renderTunesPage } from '../tunes/adminPage.js';
import type { Tune, TuneStore } from '../tunes/store.js';
import { validateAudio, validateTuneInput } from '../tunes/validate.js';

/** Stores an uploaded clip and returns its public https url (Vercel Blob in production, injected in tests). */
export type TuneAudioUploader = (id: string, bytes: Buffer, sha256: string) => Promise<string>;

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const TuneBody = z.object({
  title: z.string(),
  level: z.number(),
  tempo_bpm: z.number(),
  phrases: z.array(z.number()),
  notes: z.string(),
  scale: z.string().optional(),
  source: z.string().optional(),
});

/** What the owner sees of a tune (snake_case like the rest of the API), answer notes included. */
export function adminView(t: Tune) {
  return {
    id: t.id,
    title: t.title,
    level: t.level,
    tempo_bpm: t.tempoBpm,
    phrases: t.phrases,
    notes: t.notes,
    scale: t.scale,
    source: t.source,
    audio_url: t.audioUrl,
    audio_sha256: t.audioSha256,
    audio_bytes: t.audioBytes,
    hidden: t.hidden,
    updated_at: t.updatedAt.toISOString(),
  };
}

/** A browser post from another site carries a different Origin; refuse it (Basic auth is sent along by the browser). */
function sameOrigin(req: FastifyRequest): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

/** An m4a/mp4 file starts with a size and the `ftyp` box. */
const looksLikeM4a = (b: Buffer): boolean => b.length > 12 && b.subarray(4, 8).toString('latin1') === 'ftyp';

export function registerAdminTunes(
  root: FastifyInstance,
  tunes: TuneStore,
  upload: TuneAudioUploader,
  now: () => Date = () => new Date(),
): void {
  root.register(async (app) => {
    for (const type of ['audio/mp4', 'audio/x-m4a', 'audio/m4a', 'application/octet-stream']) {
      app.addContentTypeParser(type, { parseAs: 'buffer', bodyLimit: MAX_AUDIO_BYTES }, (_req, body, done) => done(null, body));
    }

    app.get('/admin/tunes', async (req, reply) => {
      if (!authorize(req, reply)) return reply;
      return reply.header('cache-control', 'no-store').type('text/html; charset=utf-8').send(renderTunesPage(await tunes.list({ includeHidden: true })));
    });

    app.get('/admin/tunes.json', async (req, reply) => {
      if (!authorize(req, reply)) return reply;
      return { ok: true, tunes: (await tunes.list({ includeHidden: true })).map(adminView) };
    });

    app.post('/admin/tunes/:id', async (req, reply) => {
      if (!authorize(req, reply)) return reply;
      if (!sameOrigin(req)) return reply.status(403).send({ ok: false, error: 'cross_origin' });
      const id = String((req.params as { id: string }).id);
      const body = TuneBody.safeParse(req.body);
      if (!body.success) return reply.status(422).send({ ok: false, errors: body.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
      const input = {
        id,
        title: body.data.title,
        level: body.data.level,
        tempoBpm: body.data.tempo_bpm,
        phrases: body.data.phrases,
        notes: body.data.notes,
        scale: body.data.scale || undefined,
        source: body.data.source || undefined,
      };
      const errors = validateTuneInput(input);
      if (errors.length > 0) return reply.status(422).send({ ok: false, errors });
      return { ok: true, tune: adminView(await tunes.upsert(input, now())) };
    });

    app.put('/admin/tunes/:id/audio', async (req, reply) => {
      if (!authorize(req, reply)) return reply;
      if (!sameOrigin(req)) return reply.status(403).send({ ok: false, error: 'cross_origin' });
      const id = String((req.params as { id: string }).id);
      if (!(await tunes.get(id))) return reply.status(404).send({ ok: false, error: 'unknown_tune' });
      const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (!looksLikeM4a(bytes)) return reply.status(422).send({ ok: false, errors: ['the body must be an m4a (mp4 audio) file'] });
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      let url: string;
      try {
        url = await upload(id, bytes, sha256);
      } catch (err) {
        req.log.error({ err: (err as Error).message }, 'tune audio upload failed');
        return reply.status(502).send({ ok: false, error: 'upload_failed' });
      }
      const audio = { url, sha256, bytes: bytes.length };
      const errors = validateAudio(audio);
      if (errors.length > 0) return reply.status(502).send({ ok: false, errors });
      let tune = await tunes.setAudio(id, audio, now());
      if (tune && (req.query as { show?: string }).show === '1') tune = (await tunes.setHidden(id, false, now())) ?? tune;
      return { ok: true, tune: tune ? adminView(tune) : null };
    });

    for (const action of ['show', 'hide'] as const) {
      app.post(`/admin/tunes/:id/${action}`, async (req, reply) => {
        if (!authorize(req, reply)) return reply;
        if (!sameOrigin(req)) return reply.status(403).send({ ok: false, error: 'cross_origin' });
        const id = String((req.params as { id: string }).id);
        const tune = await tunes.get(id);
        if (!tune) return reply.status(404).send({ ok: false, error: 'unknown_tune' });
        const next = await tunes.setHidden(id, action === 'hide', now());
        if (!next) return reply.status(409).send({ ok: false, error: 'no_audio' });
        return { ok: true, tune: adminView(next) };
      });
    }

    app.delete('/admin/tunes/:id', async (req, reply) => {
      if (!authorize(req, reply)) return reply;
      if (!sameOrigin(req)) return reply.status(403).send({ ok: false, error: 'cross_origin' });
      await tunes.remove(String((req.params as { id: string }).id));
      return { ok: true };
    });
  });
}

/** The production uploader: a public Vercel Blob named by tune id and the first bytes of the fingerprint. */
export async function blobTuneUploader(id: string, bytes: Buffer, sha256: string): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  const { put } = await import('@vercel/blob');
  const blob = await put(`tunes/${id}-${sha256.slice(0, 12)}.m4a`, bytes, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'audio/mp4',
    token,
  });
  return blob.url;
}
