// A rank's icon. Decorative: the rank's name is always written beside it, so a screen reader skips it.
// A rank not yet reached is shown dimmed.
import React from 'react';
import { Image } from 'react-native';
import { RANK_ICONS } from './rankIcons';

export function RankIcon({
  rankId,
  size,
  locked = false,
}: {
  rankId: string;
  size: number;
  locked?: boolean;
}) {
  const source = RANK_ICONS[rankId];
  if (!source) return null;
  return (
    <Image
      source={source}
      style={{ width: size, height: size, opacity: locked ? 0.4 : 1 }}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
