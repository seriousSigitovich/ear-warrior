// Progress aggregation (T043, US3, FR-013). Pure functions over stored Sessions/Attempts/Melodies →
// a ProgressProfile: accuracy trend, practice volume, difficulty reached, and weak areas. Kept free of
// IO so the whole US3 reporting surface is unit-testable (the hook in features/progress is a thin shell).
//
// Grading vs. volume (deliberate): accuracy and weak-area miss rates count only *graded* attempts
// (`!timedOut && !lowConfidence`) — a timed-out or noisy capture reflects the room, not the ear, and
// counting it would punish a learner for background noise (same reasoning as FR-011a). Practice
// *volume* counts every attempt, since even an aborted try is effort spent.
import { Attempt, Melody, ProgressProfile, Session } from '../../models';

export interface ProgressInput {
  sessions: Session[];
  attempts: Attempt[];
  melodies: Melody[];
}

/** An attempt is graded (counts toward accuracy) only when it was neither timed out nor low-confidence. */
function isGraded(a: Attempt): boolean {
  return !a.timedOut && !a.lowConfidence;
}

/** Rank encoded in a difficulty id of the form `"L{rank}"`; NaN-safe (returns 0 on a bad id). */
function rankOf(difficultyId: string): number {
  const rank = Number.parseInt(difficultyId.replace(/^L/, ''), 10);
  return Number.isFinite(rank) ? rank : 0;
}

/** Largest absolute melodic interval (semitones) between consecutive target notes. */
function maxInterval(melody: Melody): number {
  let max = 0;
  for (let i = 1; i < melody.notes.length; i++) {
    max = Math.max(max, Math.abs(melody.notes[i].midi - melody.notes[i - 1].midi));
  }
  return max;
}

/** Coarse interval descriptor used for weak-area grouping (step / third / leap). */
function intervalBucket(semitones: number): 'step' | 'third' | 'leap' {
  if (semitones <= 2) return 'step';
  if (semitones <= 4) return 'third';
  return 'leap';
}

function pct(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}

function roundRate(miss: number, total: number): number {
  return total === 0 ? 0 : Math.round((miss / total) * 100) / 100;
}

/**
 * Aggregate stored practice history into a ProgressProfile (US3). Deterministic and order-independent
 * in its inputs — the trend is sorted by session start, weak areas by descending miss rate.
 */
export function computeProgress(input: ProgressInput): ProgressProfile {
  const { sessions, attempts, melodies } = input;
  const melodyById = new Map(melodies.map((m) => [m.id, m]));

  // ---- accuracy trend: one point per session that has ≥1 graded attempt, ordered by start ----
  const gradedBySession = new Map<string, { correct: number; total: number }>();
  for (const a of attempts) {
    if (!isGraded(a)) continue;
    const acc = gradedBySession.get(a.sessionId) ?? { correct: 0, total: 0 };
    acc.total += 1;
    if (a.verdict === 'correct') acc.correct += 1;
    gradedBySession.set(a.sessionId, acc);
  }
  const accuracyTrend = [...sessions]
    .sort((x, y) => x.startedAt.localeCompare(y.startedAt))
    .filter((s) => gradedBySession.has(s.id))
    .map((s) => {
      const acc = gradedBySession.get(s.id)!;
      return { date: s.startedAt, accuracyPct: pct(acc.correct, acc.total) };
    });

  // ---- practice volume: every attempt, every session, elapsed minutes of ended sessions ----
  const totalMs = sessions.reduce((sum, s) => {
    if (!s.endedAt) return sum; // active/paused sessions have no closed duration yet
    return sum + (Date.parse(s.endedAt) - Date.parse(s.startedAt));
  }, 0);
  const practiceVolume = {
    totalAttempts: attempts.length,
    totalSessions: sessions.length,
    totalMinutes: Math.round(totalMs / 60000),
  };

  // ---- difficulty reached: highest rank ever attempted (0 when there is no history) ----
  const difficultyReached = attempts.reduce((max, a) => {
    const mel = melodyById.get(a.melodyId);
    return mel ? Math.max(max, rankOf(mel.difficultyId)) : max;
  }, 0);

  // ---- weak areas: miss rate grouped by melody length and largest-interval bucket ----
  const groups = new Map<string, { miss: number; total: number }>();
  const bump = (descriptor: string, missed: boolean) => {
    const g = groups.get(descriptor) ?? { miss: 0, total: 0 };
    g.total += 1;
    if (missed) g.miss += 1;
    groups.set(descriptor, g);
  };
  for (const a of attempts) {
    if (!isGraded(a)) continue;
    const mel = melodyById.get(a.melodyId);
    if (!mel) continue;
    const missed = a.verdict === 'incorrect';
    bump(`length:${mel.notes.length}`, missed);
    bump(`interval:${intervalBucket(maxInterval(mel))}`, missed);
  }
  const weakAreas = [...groups.entries()]
    .map(([descriptor, g]) => ({ descriptor, missRate: roundRate(g.miss, g.total) }))
    // Worst areas first; ties broken by descriptor for a stable, testable order.
    .sort((x, y) => y.missRate - x.missRate || x.descriptor.localeCompare(y.descriptor));

  return { accuracyTrend, practiceVolume, difficultyReached, weakAreas };
}

// ---- thin store-backed loader (used by the useProgress hook; not itself unit-tested) ----

export interface ProgressSources {
  sessions: { all(): Promise<Session[]> };
  attempts: { all(): Promise<Attempt[]> };
  melodies: { all(): Promise<Melody[]> };
}

/** Fetch all history and aggregate it. All the logic lives in the pure `computeProgress`. */
export async function loadProgress(sources: ProgressSources): Promise<ProgressProfile> {
  const [sessions, attempts, melodies] = await Promise.all([
    sources.sessions.all(),
    sources.attempts.all(),
    sources.melodies.all(),
  ]);
  return computeProgress({ sessions, attempts, melodies });
}
