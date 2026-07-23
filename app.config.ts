import type { ExpoConfig } from 'expo/config';

// Expo app configuration (T006). Microphone permission strings are required for pitch capture (FR-004).
// Supabase anon credentials are supplied via EXPO_PUBLIC_* env at build time (contracts/supabase-attempt-log.md).
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
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
};

export default config;
