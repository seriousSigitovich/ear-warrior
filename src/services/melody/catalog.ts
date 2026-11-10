// The library as a list to choose from: every tune by name, with what it asks of the learner (level,
// notes, phrases, tempo) and how they did on it. Pure.
import { Attempt } from '../../models';
import { scoreOf } from '../../lib/review';
import { LIBRARY, tuneIdOf } from './curated';

export interface CatalogTune {
  id: string;
  /** The tune's name. */
  name: string;
  rank: number;
  notes: number;
  phrases: number;
  tempoBpm: number;
  /** Finished at least once. */
  played: boolean;
  /** Best score so far (0–100); null until played. */
  bestPct: number | null;
}

export interface CatalogLevel {
  rank: number;
  tunes: CatalogTune[];
  /** Tunes of the level finished at least once. */
  played: number;
}

/** The whole library, level by level, against the learner's finished tunes. */
export function libraryCatalog(
  attempts: readonly Pick<Attempt, 'melodyId' | 'noteResults'>[],
): CatalogLevel[] {
  const best = new Map<string, number>();
  for (const a of attempts) {
    const id = tuneIdOf(a.melodyId);
    best.set(id, Math.max(best.get(id) ?? 0, scoreOf(a.noteResults).pct));
  }
  const levels = new Map<number, CatalogTune[]>();
  LIBRARY.forEach((t) => {
    const tune: CatalogTune = {
      id: t.id,
      name: t.title,
      rank: t.rank,
      notes: t.notes.trim().split(/\s+/).length,
      phrases: t.phrases.length,
      tempoBpm: t.tempoBpm,
      played: best.has(t.id),
      bestPct: best.get(t.id) ?? null,
    };
    levels.set(t.rank, [...(levels.get(t.rank) ?? []), tune]);
  });
  return [...levels.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rank, tunes]) => ({ rank, tunes, played: tunes.filter((t) => t.played).length }));
}

/** One tune of the library by id, or null. */
export function catalogTune(
  id: string,
  attempts: readonly Pick<Attempt, 'melodyId' | 'noteResults'>[] = [],
): CatalogTune | null {
  for (const level of libraryCatalog(attempts)) {
    const tune = level.tunes.find((t) => t.id === id);
    if (tune) return tune;
  }
  return null;
}

/** What a tune asks, in a line: "24 notes · 4 phrases · 96 BPM". */
export function tuneAsk(t: Pick<CatalogTune, 'notes' | 'phrases' | 'tempoBpm'>): string {
  return `${t.notes} notes · ${t.phrases} ${t.phrases === 1 ? 'phrase' : 'phrases'} · ${t.tempoBpm} BPM`;
}
