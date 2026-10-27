// Audio-session helper: puts the output stream in playback mode before a melody plays. The native
// audio-mode call is injected so the sequencing stays testable.

export interface AudioSessionDriver {
  configureForPlayback(): Promise<void>;
}

/** Real expo-audio audio-mode adapter (lazily required; not loaded under the pure-logic test runner). */
export function defaultAudioSessionDriver(): AudioSessionDriver {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped native module handle
  let audioMod: any;
  const audio = () => (audioMod ??= require('expo-audio'));
  return {
    configureForPlayback: () =>
      audio().setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }),
  };
}

export interface AudioSession {
  enterPlayback(): Promise<void>;
}

export function createAudioSession(
  driver: AudioSessionDriver = defaultAudioSessionDriver(),
): AudioSession {
  return { enterPlayback: () => driver.configureForPlayback() };
}
