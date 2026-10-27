import type { ExpoConfig } from 'expo/config';

// Expo app configuration (T006). Microphone permission strings are required for pitch capture (FR-004).
// The backend base URL is supplied via EXPO_PUBLIC_API_URL at build time and points at the
// Ear Warrior Node/Postgres server (server/). Absent → telemetry and sync are no-ops (offline-only).

// EAS project id (`eas init` prints it). OTA updates are served from https://u.expo.dev/<id>.
const EAS_PROJECT_ID = 'aa205069-4373-4d4f-aeed-d38c53e33380';

// On EAS builds an empty id would ship a binary that can never receive an OTA update, so fail loudly.
if (
  !EAS_PROJECT_ID &&
  process.env.EAS_BUILD_PROFILE &&
  process.env.EAS_BUILD_PROFILE !== 'development'
) {
  throw new Error(
    'app.config.ts: set EAS_PROJECT_ID (run `eas init`) before building — OTA needs it.',
  );
}

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
  icon: './assets/app/icon.png',
  android: {
    package: 'com.earwarrior.app',
    // Play rejects an upload whose versionCode was already used. appVersionSource is `local` (eas.json),
    // so bump this by one before every AAB upload.
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/app/adaptive-fg.png',
      monochromeImage: './assets/app/adaptive-fg.png',
      backgroundColor: '#f5f3ee',
    },
    // The MVP answers on the on-screen fretboard (R14), so the Android build declares no microphone
    // access. react-native-pitchy's own manifest adds RECORD_AUDIO, so it is blocked explicitly
    // (manifest merger `tools:node="remove"`). Restore both with the `mic` input mode (T078).
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
  },
  plugins: [
    'expo-router',
    'expo-updates',
    // Cream ear on the Nocturne ground (src/theme/nocturne.ts `bg`), so launch does not flash light.
    [
      'expo-splash-screen',
      { image: './assets/app/splash.png', backgroundColor: '#161826', imageWidth: 200 },
    ],
    // Sentry native SDK + source-map upload. Upload needs SENTRY_AUTH_TOKEN (EAS secret); without it the build still succeeds.
    // Org/project are literals, not env: the plugin options are part of the OTA fingerprint, and an env var set only
    // on EAS makes the local and remote runtime versions differ ("Runtime version calculated on local machine...").
    ['@sentry/react-native/expo', { organization: 'sigitovich-solutions', project: 'ear-warrior-app' }],
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
  // Fingerprint policy: an OTA only reaches binaries whose native layer matches, so JS updates never
  // land on a build that lacks a native module they need (e.g. before the expo-secure-store rebuild).
  runtimeVersion: { policy: 'fingerprint' },
  updates: EAS_PROJECT_ID ? { url: `https://u.expo.dev/${EAS_PROJECT_ID}` } : undefined,
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    eas: EAS_PROJECT_ID ? { projectId: EAS_PROJECT_ID } : undefined,
  },
};

export default config;
