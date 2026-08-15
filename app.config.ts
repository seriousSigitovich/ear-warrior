import type { ExpoConfig } from 'expo/config';

// Expo app configuration (T006). Microphone permission strings are required for pitch capture (FR-004).
// The backend base URL is supplied via EXPO_PUBLIC_API_URL at build time and points at the
// Ear Warrior Node/Postgres server (server/). Absent → telemetry and sync are no-ops (offline-only).
const config: ExpoConfig = {
  name: 'Ear Warrior',
  slug: 'ear-warrior',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'earwarrior',
  newArchEnabled: false,
  ios: {
    bundleIdentifier: 'com.earwarrior.app',
    supportsTablet: true,
  },
  android: {
    package: 'com.earwarrior.app',
    permissions: ['RECORD_AUDIO'],
  },
  plugins: [
    'expo-router',
    // expo-audio config plugin sets the microphone permission strings (FR-004).
    [
      'expo-audio',
      {
        microphonePermission:
          'Ear Warrior listens through your microphone to detect the notes you play on the guitar.',
        enableBackgroundPlayback: false,
      },
    ],
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
  },
};

export default config;
