// Progress screen — placeholder for User Story 3 (accuracy trends, weak areas, T046).
// Implemented when US3 is built; kept as a route so navigation is complete.
import React from 'react';
import { Text } from 'react-native';
import { Screen } from '../src/components/common/Screen';

export default function Progress() {
  return (
    <Screen title="Progress">
      <Text style={{ color: '#C1C2C5', fontSize: 16 }}>
        Accuracy trends, practice volume, and weak areas arrive with User Story 3.
      </Text>
    </Screen>
  );
}
