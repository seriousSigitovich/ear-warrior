// The reward standing (rank, XP, mastery, challenges, streak), re-read whenever a screen regains focus so
// it is fresh after practice. A thin shell: everything is computed by the service.
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getGamification } from '../../services/gamification/instance';
import { Snapshot } from '../../services/gamification/service';

/** The current standing, or null until it has loaded (or if the store could not be read). */
export function useGamification(): Snapshot | null {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getGamification()
        .snapshot()
        .then((s) => {
          if (!cancelled) setSnapshot(s);
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, []),
  );
  return snapshot;
}
