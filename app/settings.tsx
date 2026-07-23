// Difficulty settings screen — placeholder for User Story 2 (adaptive/fixed difficulty, T041).
// Implemented when US2 is built; kept as a route so navigation is complete.
import React from 'react';
import { Text } from 'react-native';
import { Screen } from '../src/components/common/Screen';

export default function Settings() {
  return (
    <Screen title="Difficulty">
      <Text style={{ color: '#C1C2C5', fontSize: 16 }}>
        Adaptive and fixed difficulty controls arrive with User Story 2.
      </Text>
    </Screen>
  );
}
