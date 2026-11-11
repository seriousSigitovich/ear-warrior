// The streak's fire icon. Decorative: the number beside it carries the meaning.
import React from 'react';
import { Text } from 'react-native';

export function Flame({ size = 16 }: { size?: number }) {
  return (
    <Text
      style={{ fontSize: size, lineHeight: size + 4 }}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      🔥
    </Text>
  );
}
