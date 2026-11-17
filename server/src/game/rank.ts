// The rank of a total of XP (spec 024, FR-013): the highest rank whose threshold is met. Nothing else counts.
import { RANKS, type RankDef } from './config.js';

export interface RankState {
  id: string;
  name: string;
  index: number;
  /** The rank above; null at the top. */
  next: { id: string; name: string; xp: number } | null;
  /** XP still needed for the next rank (0 at the top). */
  xp_to_next: number;
  /** 0–100: how far the XP is from this rank's threshold to the next one's. */
  pct: number;
}

export function rankOf(totalXp: number, ranks: readonly RankDef[] = RANKS): RankState {
  const xp = Math.max(0, Math.floor(totalXp));
  let index = 0;
  while (ranks[index + 1] && xp >= ranks[index + 1].xp) index++;
  const rank = ranks[index];
  const next = ranks[index + 1] ?? null;
  return {
    id: rank.id,
    name: rank.name,
    index,
    next: next ? { id: next.id, name: next.name, xp: next.xp } : null,
    xp_to_next: next ? next.xp - xp : 0,
    pct: next ? Math.min(100, Math.max(0, Math.round(((xp - rank.xp) / (next.xp - rank.xp)) * 100))) : 100,
  };
}

/** The new rank when going from `before` XP to `after` XP raised it, else null. */
export function rankUp(before: number, after: number, ranks: readonly RankDef[] = RANKS): { id: string; name: string } | null {
  const a = rankOf(before, ranks);
  const b = rankOf(after, ranks);
  return b.index > a.index ? { id: b.id, name: b.name } : null;
}
