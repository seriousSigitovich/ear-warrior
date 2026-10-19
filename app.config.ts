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
    // The MVP answers on the on-screen fretboard (R14), so the Android build declares no microphone
    // access. react-native-pitchy's own manifest adds RECORD_AUDIO, so it is blocked explicitly
    // (manifest merger `tools:node="remove"`). Restore both with the `mic` input mode (T078).
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
  },
  plugins: [
    'expo-router',
    // expo-audio config plugin sets the iOS microphone string (FR-004); `recordAudioAndroid: false`
    // keeps RECORD_AUDIO out of the Android manifest.
    [
      'expo-audio',
      {
        microphonePermission:
          'Ear Warrior listens through your microphone to detect the notes you play on the guitar.',
        recordAudioAndroid: false,
        enableBackgroundPlayback: false,
      },
    ],
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
  },
};

export default config;
