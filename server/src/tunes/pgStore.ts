// Postgres TuneStore (Drizzle). Table: db/ddl.ts.
import { asc, eq, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { tunes } from '../db/schema.js';
import type { Tune, TuneStore } from './store.js';

type Row = typeof tunes.$inferSelect;
const toTune = (r: Row): Tune => ({
  id: r.id,
  title: r.title,
  level: r.level,
  tempoBpm: r.tempoBpm,
  phrases: r.phrases,
  notes: r.notes,
  scale: r.scale,
  source: r.source,
  audioUrl: r.audioUrl,
  audioSha256: r.audioSha256,
  audioBytes: r.audioBytes,
  hidden: r.hidden,
  updatedAt: r.updatedAt,
});

export function createPgTuneStore(db: PostgresJsDatabase<Record<string, unknown>>): TuneStore {
  return {
    async get(id) {
      const [row] = await db.select().from(tunes).where(eq(tunes.id, id)).limit(1);
      return row ? toTune(row) : null;
    },
    async list({ includeHidden = false } = {}) {
      const q = db.select().from(tunes).orderBy(asc(tunes.level), asc(tunes.id));
      const rows = includeHidden ? await q : await q.where(eq(tunes.hidden, false));
      return rows.map(toTune);
    },
    async upsert(input, now) {
      const fields = {
        title: input.title,
        level: input.level,
        tempoBpm: input.tempoBpm,
        phrases: input.phrases,
        notes: input.notes,
        updatedAt: now,
        ...(input.scale !== undefined ? { scale: input.scale } : {}),
        ...(input.source !== undefined ? { source: input.source } : {}),
      };
      const [row] = await db
        .insert(tunes)
        .values({ id: input.id, ...fields })
        .onConflictDoUpdate({ target: tunes.id, set: fields })
        .returning();
      return toTune(row);
    },
    async setAudio(id, audio, now) {
      const [row] = await db
        .update(tunes)
        .set({ audioUrl: audio.url, audioSha256: audio.sha256, audioBytes: audio.bytes, updatedAt: now })
        .where(eq(tunes.id, id))
        .returning();
      return row ? toTune(row) : null;
    },
    async setHidden(id, hidden, now) {
      const [row] = await db
        .update(tunes)
        .set({ hidden, updatedAt: now })
        .where(hidden ? eq(tunes.id, id) : sql`${tunes.id} = ${id} and ${tunes.audioUrl} is not null`)
        .returning();
      return row ? toTune(row) : null;
    },
    async remove(id) {
      await db.delete(tunes).where(eq(tunes.id, id));
    },
  };
}
