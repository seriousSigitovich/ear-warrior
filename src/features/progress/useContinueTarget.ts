// What Home's Continue opens (see lib/lastOpened): the saved place or the melody last opened, re-read whenever
// the screen regains focus. A thin shell over the place hook and the key-value store.
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { KEY_VALUE_TABLE, defaultRowStore } from '../../services/storage/db';
import { keyValueOverRowStore } from '../../lib/deviceId';
import { ContinueTarget, OpenedTune, continueTarget, readOpened } from '../../lib/lastOpened';
import { catalogTune } from '../../services/melody/catalog';
import { useMelodyProgress } from './useMelodyProgress';

export function useContinueTarget(): ContinueTarget | null {
  const places = useMelodyProgress();
  const [opened, setOpened] = useState<OpenedTune | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void readOpened(keyValueOverRowStore(defaultRowStore(), KEY_VALUE_TABLE))
        .then((o) => {
          if (!cancelled) setOpened(o);
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, []),
  );
  return useMemo(
    () => continueTarget(places.values(), opened, (id) => catalogTune(id)?.phrases ?? null),
    [places, opened],
  );
}
