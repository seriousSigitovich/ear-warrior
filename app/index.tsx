// Home screen (T035): start a practice session and navigate into the core loop.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../src/components/common/Screen';
import { Button } from '../src/components/common/Button';

export default function Home() {
  const router = useRouter();
  return (
    <Screen title="Ear Warrior">
      <View style={styles.body}>
        <Text style={styles.blurb}>
          Hear a short melody, then play it back on your guitar. We’ll tell you which notes you nailed.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button label="Start practice" onPress={() => router.push('/practice')} />
        <Button label="Difficulty" variant="secondary" onPress={() => router.push('/settings')} />
        <Button label="Progress" variant="secondary" onPress={() => router.push('/progress')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center' },
  blurb: { color: '#C1C2C5', fontSize: 18, lineHeight: 26 },
  actions: { gap: 12 },
});
