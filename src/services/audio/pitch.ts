// Pitch-detection service (contracts/pitch-detection.md). Wraps the native YIN detector
// (react-native-pitchy) behind a small injectable adapter so orchestration is testable and the
// native binding is isolated. It owns permission + lifecycle; it does NOT grade or segment.
import { PitchFrame } from '../../models';

export interface PitchDetectionConfig {
  minHz: number; // default ~80 (below E2 guard)
  maxHz: number; // default ~1320 (above E6 guard)
  clarityThreshold: number; // frames below → treated as silence by the segmenter
}

export interface PitchDetector {
  requestPermission(): Promise<boolean>;
  start(cfg: PitchDetectionConfig, onFrame: (f: PitchFrame) => void): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

/** Thin adapter over the native module; the real binding lives in `defaultNativePitch`. */
export interface NativePitchModule {
  requestPermission(): Promise<boolean>;
  start(cfg: PitchDetectionConfig, onFrame: (f: PitchFrame) => void): Promise<void>;
  stop(): Promise<void>;
}

export type PitchErrorCode = 'permission-denied' | 'already-running';

export class PitchError extends Error {
  constructor(public code: PitchErrorCode) {
    super(code);
    this.name = 'PitchError';
  }
}

/**
 * Real native adapter. Isolated + lazily required so it never loads under the pure-logic test runner.
 * NOTE: the exact react-native-pitchy surface must be confirmed against the installed version on-device
 * (feasibility spike, research R2) — this maps its frame events to our PitchFrame shape.
 */
export function defaultNativePitch(): NativePitchModule {
  let subscription: { remove: () => void } | null = null;
  // Lazily resolved so constructing the detector never loads the native module (keeps the UI mountable
  // under Expo Go, where the native side is absent; capture itself needs a custom dev client).
  let cached: any;
  const pitchy = () => {
    if (!cached) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('react-native-pitchy');
      // The library ships `Pitchy` as a default export, so under CommonJS interop
      // init/start/stop/addListener live on `.default`, not the module top level.
      cached = mod.default ?? mod;
    }
    return cached;
  };
  return {
    // react-native-pitchy has no permission API of its own; microphone permission is owned by
    // the AudioSession (expo-audio) and requested in the practice loop before capture starts.
    requestPermission: () => Promise.resolve(true),
    async start(_cfg, onFrame) {
      // init() is synchronous and takes a PitchyConfig — NOT our band-pass PitchDetectionConfig
      // (minHz/maxHz/clarity are applied JS-side by the segmenter). minVolume is dBFS: the library
      // default is -60; the old `0` demanded full-scale loudness and silenced every frame.
      pitchy().init({ algorithm: 'YIN', minVolume: -60, minConfidence: 0 });
      subscription = pitchy().addListener(
        (raw: { pitch: number; confidence?: number; tCaptureMs?: number }) => {
          onFrame({
            hz: raw.pitch > 0 ? raw.pitch : 0, // pitchy reports -1 when unvoiced
            clarity: raw.confidence ?? 0, // the event field is `confidence`, not `clarity`
            // tCaptureMs is the sample's true capture time (Date.now() epoch), immune to bridge
            // backlog — use it so burst-delivered frames keep their real spacing for segmentation.
            timestampMs: raw.tCaptureMs ?? Date.now(),
          });
        },
      );
      await pitchy().start();
    },
    async stop() {
      subscription?.remove();
      subscription = null;
      await pitchy().stop();
    },
  };
}

/** Create a pitch detector over an injected native adapter (defaults to the real one). */
export function createPitchDetector(
  native: NativePitchModule = defaultNativePitch(),
): PitchDetector {
  let running = false;
  return {
    requestPermission: () => native.requestPermission(),
    async start(cfg, onFrame) {
      if (running) {
        throw new PitchError('already-running');
      }
      const granted = await native.requestPermission();
      if (!granted) {
        throw new PitchError('permission-denied');
      }
      await native.start(cfg, onFrame);
      running = true;
    },
    async stop() {
      if (running) {
        await native.stop();
        running = false;
      }
    },
    isRunning: () => running,
  };
}
