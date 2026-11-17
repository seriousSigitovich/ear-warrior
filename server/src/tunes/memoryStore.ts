// In-memory TuneStore (tests and local runs without Postgres).
import type { Tune, TuneStore } from './store.js';

export function createMemoryTuneStore(): TuneStore {
  const tunes = new Map<string, Tune>();
  return {
    async get(id) {
      return tunes.get(id) ?? null;
    },
    async list({ includeHidden = false } = {}) {
      return [...tunes.values()]
        .filter((t) => includeHidden || !t.hidden)
        .sort((a, b) => a.level - b.level || a.id.localeCompare(b.id));
    },
    async upsert(input, now) {
      const old = tunes.get(input.id);
      const tune: Tune = {
        id: input.id,
        title: input.title,
        level: input.level,
        tempoBpm: input.tempoBpm,
        phrases: [...input.phrases],
        notes: input.notes,
        scale: input.scale ?? old?.scale ?? '',
        source: input.source ?? old?.source ?? '',
        audioUrl: old?.audioUrl ?? null,
        audioSha256: old?.audioSha256 ?? null,
        audioBytes: old?.audioBytes ?? null,
        hidden: old?.hidden ?? true,
        updatedAt: now,
      };
      tunes.set(tune.id, tune);
      return tune;
    },
    async setAudio(id, audio, now) {
      const t = tunes.get(id);
      if (!t) return null;
      const next = { ...t, audioUrl: audio.url, audioSha256: audio.sha256, audioBytes: audio.bytes, updatedAt: now };
      tunes.set(id, next);
      return next;
    },
    async setHidden(id, hidden, now) {
      const t = tunes.get(id);
      if (!t || (!hidden && t.audioUrl === null)) return null;
      const next = { ...t, hidden, updatedAt: now };
      tunes.set(id, next);
      return next;
    },
    async remove(id) {
      tunes.delete(id);
    },
  };
}
