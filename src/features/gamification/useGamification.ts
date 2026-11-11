// The reward standing (rank, XP, mastery, challenges, streak), re-read whenever a screen regains focus so
// it is fresh after practice. A thin shell: everything is computed by the service. The first read never waits
// for the network; the day's challenges are asked for after it (once a day) and the standing is read again
// if new ones arrived.
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getGamification } from '../../services/gamification/instance';
import { requestSync } from '../../services/sync/instance';
import { Snapshot } from '../../services/gamification/service';

/** The current standing, or null until it has loaded (or if the store could not be read). */
export function useGamification(): Snapshot | null {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const game = getGamification();
      game
        .snapshot()
        .then((s) => {
          if (!cancelled) setSnapshot(s);
        })
        .then(() => game.refreshChallenges())
        // Rewards earned on another device arrive here (once a minute at most), then the standing is read again.
        .then(async (fresh) => (await requestSync()) || fresh)
        .then(async (changed) => {
          if (changed && !cancelled) setSnapshot(await game.snapshot());
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, []),
  );
  return snapshot;
}
