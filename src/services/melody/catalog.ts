// The library as a list to choose from: every tune by name, with what it asks of the learner (level,
// notes, phrases, tempo) and how they did on it. Pure.
import { Attempt } from '../../models';
import { IntervalKind, intervalKind } from '../../lib/insights';
import { phraseRange, phraseCount } from '../../lib/phrases';
import { scoreOf } from '../../lib/review';
import { LIBRARY, curatedMelody, tuneIdOf } from './curated';
import { MIN_RANK, getLevelByRank } from './levels';

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
    .map(([rank, tunes]) => ({
      rank,
      tunes,
      played: tunes.filter((t) => t.played).length,
    }));
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

/** The melodic moves of a library tune, counted inside its phrases (a phrase's first note has none). */
export interface TuneIntervals {
  counts: Partial<Record<IntervalKind, number>>;
  total: number;
}

export function tuneIntervals(id: string): TuneIntervals | null {
  const tune = LIBRARY.find((t) => t.id === id);
  if (!tune) return null;
  const melody = curatedMelody(getLevelByRank(tune.rank), 0, tune.id);
  const counts: Partial<Record<IntervalKind, number>> = {};
  let total = 0;
  for (let p = 0; p < phraseCount(melody); p++) {
    const { start, end } = phraseRange(melody, p);
    for (let i = start + 1; i < end; i++) {
      const kind = intervalKind(melody.notes[i].midi - melody.notes[i - 1].midi);
      counts[kind] = (counts[kind] ?? 0) + 1;
      total += 1;
    }
  }
  return { counts, total };
}

/** A tune needs this many moves of a kind to be practice for it. */
const MIN_MOVES = 3;

export interface IntervalPick {
  tune: CatalogTune;
  /** How many of the tune's moves are of the kind asked for. */
  count: number;
}

/**
 * Tunes to practise a kind of move on: those fullest of it (by share of their moves), no more than
 * one level above the highest the learner has played, with tunes not yet played at 100% first.
 */
export function tunesForInterval(
  kind: IntervalKind,
  attempts: readonly Pick<Attempt, 'melodyId' | 'noteResults'>[],
  limit = 3,
): IntervalPick[] {
  const tunes = libraryCatalog(attempts).flatMap((l) => l.tunes);
  const reached = Math.max(MIN_RANK, ...tunes.filter((t) => t.played).map((t) => t.rank));
  return tunes
    .filter((t) => t.rank <= reached + 1)
    .map((tune) => {
      const moves = tuneIntervals(tune.id)!;
      const count = moves.counts[kind] ?? 0;
      return { tune, count, share: moves.total === 0 ? 0 : count / moves.total };
    })
    .filter((p) => p.count >= MIN_MOVES)
    .sort(
      (a, b) =>
        Number(a.tune.bestPct === 100) - Number(b.tune.bestPct === 100) ||
        b.share - a.share ||
        a.tune.rank - b.tune.rank,
    )
    .slice(0, limit)
    .map(({ tune, count }) => ({ tune, count }));
}
