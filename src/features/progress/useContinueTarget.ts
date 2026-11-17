// What Home's Continue opens (see lib/lastOpened): the melody last played (half-answered or finished), else the one
// last opened, re-read whenever the screen regains focus. A thin shell over the place hook, the history and the
// key-value store.
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { KEY_VALUE_TABLE, defaultRowStore } from '../../services/storage/db';
import { keyValueOverRowStore } from '../../lib/deviceId';
import {
  ContinueTarget,
  OpenedTune,
  PlayedTune,
  continueTarget,
  readOpened,
} from '../../lib/lastOpened';
import { tuneIdOf } from '../../services/melody/curated';
import { useHistory } from './useHistory';
import { catalogTune } from '../../services/melody/catalog';
import { useLibraryVersion } from '../tunes/useLibrary';
import { useMelodyProgress } from './useMelodyProgress';

export function useContinueTarget(): ContinueTarget | null {
  const places = useMelodyProgress();
  const { attempts } = useHistory();
  const played = useMemo<PlayedTune[]>(
    () =>
      attempts.map((a) => ({
        tuneId: tuneIdOf(a.melodyId),
        at: a.createdAt,
        results: a.noteResults,
      })),
    [attempts],
  );
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
  const library = useLibraryVersion(); // a tune's phrases come from the catalog
  return useMemo(
    () => continueTarget(places.values(), opened, (id) => catalogTune(id)?.phrases ?? null, played),
    [places, opened, played, library],
  );
}
