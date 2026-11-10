// The learner's finished tunes on this device, re-read whenever the screen regains focus. A thin shell
// over the durable store: what is made of them (streak, mistake review, the library's "played" marks)
// lives in pure modules (lib/streak, lib/review, services/melody/catalog). On a load error it yields
// an empty history so a screen shows its empty state rather than waiting forever.
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Attempt, Melody } from '../../models';
import { defaultRowStore } from '../../services/storage/db';
import {
  createAttemptRepository,
  createMelodyRepository,
} from '../../services/storage/repositories';

export interface History {
  attempts: Attempt[];
  melodies: Melody[];
  loading: boolean;
}

export function useHistory(): History {
  const [data, setData] = useState<{ attempts: Attempt[]; melodies: Melody[] } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const store = defaultRowStore();
      Promise.all([createAttemptRepository(store).all(), createMelodyRepository(store).all()])
        .then(([attempts, melodies]) => {
          if (!cancelled) setData({ attempts, melodies });
        })
        .catch(() => {
          if (!cancelled) setData({ attempts: [], melodies: [] });
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return { attempts: data?.attempts ?? [], melodies: data?.melodies ?? [], loading: data === null };
}
