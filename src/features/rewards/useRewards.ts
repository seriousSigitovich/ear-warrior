// The reward standing (rank, XP, streak, challenges), re-read from the server whenever a screen regains focus, and
// redrawn whenever an answer changes it. The app computes none of it.
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getRewards } from '../../services/rewards/instance';
import type { RewardsView } from '../../services/rewards/types';

/** The current standing, or null until the device or the server has given one. */
export function useRewards(): RewardsView | null {
  const [view, setView] = useState<RewardsView | null>(() => getRewards().view());
  useEffect(() => {
    const rewards = getRewards();
    setView(rewards.view());
    return rewards.subscribe(() => setView(rewards.view()));
  }, []);
  useFocusEffect(
    useCallback(() => {
      const rewards = getRewards();
      void rewards
        .flush()
        .then(() => rewards.refresh())
        .catch(() => undefined);
    }, []),
  );
  return view;
}
