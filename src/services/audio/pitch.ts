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
      cached = require('react-native-pitchy');
    }
    return cached;
  };
  return {
    requestPermission: () => pitchy().checkPermissionsAndInit?.() ?? Promise.resolve(true),
    async start(cfg, onFrame) {
      await pitchy().init({ minVolume: 0, ...cfg });
      subscription = pitchy().addListener((raw: { pitch: number; clarity?: number }) => {
        onFrame({
          hz: raw.pitch ?? 0,
          clarity: raw.clarity ?? 0,
          timestampMs: Date.now(),
        });
      });
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
