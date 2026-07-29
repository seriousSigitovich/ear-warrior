// Progress view hook (T044, US3). A thin shell: it builds the read-only repositories over the durable
// store and delegates every calculation to the pure `computeProgress`/`loadProgress` in
// services/storage/progress (which is unit-tested). On any load error it falls back to an empty
// profile so the screen shows its empty state rather than spinning forever.
import { useEffect, useState } from 'react';
import { ProgressProfile } from '../../models';
import { defaultRowStore } from '../../services/storage/db';
import {
  createAttemptRepository,
  createMelodyRepository,
  createSessionRepository,
} from '../../services/storage/repositories';
import { loadProgress } from '../../services/storage/progress';

const EMPTY_PROFILE: ProgressProfile = {
  accuracyTrend: [],
  practiceVolume: { totalAttempts: 0, totalSessions: 0, totalMinutes: 0 },
  difficultyReached: 0,
  weakAreas: [],
};

export interface ProgressView {
  profile: ProgressProfile | null;
  loading: boolean;
}

export function useProgress(): ProgressView {
  const [profile, setProfile] = useState<ProgressProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    const store = defaultRowStore();
    loadProgress({
      sessions: createSessionRepository(store),
      attempts: createAttemptRepository(store),
      melodies: createMelodyRepository(store),
    })
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setProfile(EMPTY_PROFILE);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { profile, loading: profile === null };
}
