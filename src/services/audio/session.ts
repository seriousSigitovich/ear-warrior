// Microphone-permission + audio-session helper (R7): ensure melody playback fully stops and the
// output stream is torn down BEFORE microphone capture starts (sequential listen-then-play, avoids
// echo/feedback). The native audio-mode calls are injected so the sequencing is testable.

export interface AudioSessionDriver {
  requestMicPermission(): Promise<boolean>;
  configureForPlayback(): Promise<void>;
  configureForRecording(): Promise<void>;
  teardown(): Promise<void>;
}

/** Real expo-audio audio-mode adapter (lazily required; not loaded under the pure-logic test runner). */
export function defaultAudioSessionDriver(): AudioSessionDriver {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped native module handle
  let audioMod: any;
  const audio = () => (audioMod ??= require('expo-audio'));
  return {
    async requestMicPermission() {
      const res = await audio().AudioModule.requestRecordingPermissionsAsync();
      return !!res.granted;
    },
    configureForPlayback: () =>
      audio().setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }),
    // Playback output is torn down first, then capture is configured (R7).
    configureForRecording: () =>
      audio().setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true }),
    teardown: () => audio().setAudioModeAsync({ allowsRecording: false }),
  };
}

export interface AudioSession {
  ensureMicPermission(): Promise<boolean>;
  enterPlayback(): Promise<void>;
  enterRecording(): Promise<void>;
  release(): Promise<void>;
}

export function createAudioSession(
  driver: AudioSessionDriver = defaultAudioSessionDriver(),
): AudioSession {
  return {
    ensureMicPermission: () => driver.requestMicPermission(),
    enterPlayback: () => driver.configureForPlayback(),
    // Playback output is torn down first, then capture is configured (R7).
    async enterRecording() {
      await driver.teardown();
      await driver.configureForRecording();
    },
    release: () => driver.teardown(),
  };
}
