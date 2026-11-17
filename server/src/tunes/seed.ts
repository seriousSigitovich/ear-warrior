// Loads the app's library (library.data.ts, exported from src/services/melody/library.ts by
// scripts/export-library.ts) into the tunes table. Idempotent: running it again rewrites the same fields and
// never touches audio or visibility.
import { TUNES } from './library.data.js';
import { validateTuneInput } from './validate.js';
import type { TuneStore } from './store.js';

export async function seedTunes(store: TuneStore, now: Date = new Date()): Promise<{ tunes: number }> {
  for (const t of TUNES) {
    const input = {
      id: t.id,
      title: t.title,
      level: t.rank,
      tempoBpm: t.tempoBpm,
      phrases: [...t.phrases],
      notes: t.notes,
      scale: t.scale,
      source: t.source,
    };
    const problems = validateTuneInput(input);
    if (problems.length > 0) throw new Error(`Library tune "${t.id}" is invalid: ${problems.join('; ')}`);
    await store.upsert(input, now);
  }
  return { tunes: TUNES.length };
}
