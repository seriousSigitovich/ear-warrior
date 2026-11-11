// Levels and their requirements in words (spec 013). A level is shown by its rank on the ladder, read
// from the app's own levels rather than parsed out of an id.
import { getLevel } from '../services/melody/levels';

/** "Level 3" for a level id. */
export function levelLabel(id: string): string {
  try {
    return `Level ${getLevel(id).rank}`;
  } catch {
    return id;
  }
}

/** The mastery a rank asks for: "Level 1", "Levels 1–4", or "No mastery needed". */
export function masteryRequirement(ids: readonly string[]): string {
  if (ids.length === 0) return 'No mastery needed';
  const ranks = ids
    .map((id) => {
      try {
        return getLevel(id).rank;
      } catch {
        return NaN;
      }
    })
    .filter((r) => !Number.isNaN(r))
    .sort((a, b) => a - b);
  if (ranks.length === 0) return ids.join(', ');
  if (ranks.length === 1) return `Level ${ranks[0]}`;
  const contiguous = ranks.every((r, i) => i === 0 || r === ranks[i - 1] + 1);
  return contiguous
    ? `Levels ${ranks[0]}–${ranks[ranks.length - 1]}`
    : `Levels ${ranks.join(', ')}`;
}
