// Where the learner stopped in each melody (spec 017), keyed by tune id, re-read whenever the screen regains
// focus: the device's copy at once, then again after a sync with the server (another device's place, a
// melody finished elsewhere). A thin shell over the repository and the sync.
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { MelodyPlaceRow } from '../../lib/melodyProgress';
import { getMelodyProgress } from '../../services/progress/instance';

export function useMelodyProgress(): ReadonlyMap<string, MelodyPlaceRow> {
  const [places, setPlaces] = useState<ReadonlyMap<string, MelodyPlaceRow>>(new Map());
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const { repo, sync } = getMelodyProgress();
      const read = async () => {
        const all = await repo.all();
        if (!cancelled) setPlaces(new Map(all.map((p) => [p.tuneId, p])));
      };
      void read()
        .then(() => sync?.sync())
        .then(read)
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, []),
  );
  return places;
}
