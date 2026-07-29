// T055 (US1, FR-pitch): regression test for the REAL react-native-pitchy adapter `defaultNativePitch()`.
// contracts/pitch-detection.md. The existing pitch.test.ts only drives the injected fake
// NativePitchModule, so it never caught that the library ships its API on the CommonJS `.default`
// export — the on-device crash was `init/start/addListener` being undefined on the module namespace.
// Here the mock puts the methods ONLY on `default`, so the adapter passes iff it resolves `.default`,
// and we assert the confidence→clarity / tCaptureMs→timestamp / pitch≤0→unvoiced mapping.

// Methods live only on `default` — mirrors the real module and forces the `.default` resolution path.
const mockInit = jest.fn();
const mockStart = jest.fn(async () => {});
const mockStop = jest.fn(async () => {});
const mockRemove = jest.fn();
const mockListenerRef: { current: ((raw: Record<string, number>) => void) | null } = {
  current: null,
};
const mockAddListener = jest.fn((cb: (raw: Record<string, number>) => void) => {
  mockListenerRef.current = cb;
  return { remove: mockRemove };
});

jest.mock('react-native-pitchy', () => ({
  __esModule: true,
  default: {
    init: mockInit,
    start: mockStart,
    stop: mockStop,
    addListener: mockAddListener,
  },
}));

import { PitchFrame } from '../../src/models';
import { PitchDetectionConfig, defaultNativePitch } from '../../src/services/audio/pitch';

const CFG: PitchDetectionConfig = { minHz: 80, maxHz: 1320, clarityThreshold: 0.5 };

beforeEach(() => {
  jest.clearAllMocks();
  mockListenerRef.current = null;
});

describe('defaultNativePitch (real react-native-pitchy adapter)', () => {
  test('resolves the library default export and initializes YIN with the -60 dBFS floor', async () => {
    const native = defaultNativePitch();
    await native.start(CFG, () => {});
    // init/start were invoked on the `.default` object — if the adapter used the module namespace,
    // these would be undefined and the call would have thrown.
    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockInit).toHaveBeenCalledWith(expect.objectContaining({ algorithm: 'YIN', minVolume: -60 }));
    expect(mockAddListener).toHaveBeenCalledTimes(1);
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  test('maps a raw event to a PitchFrame (confidence→clarity, tCaptureMs→timestamp)', async () => {
    const native = defaultNativePitch();
    const frames: PitchFrame[] = [];
    await native.start(CFG, (f) => frames.push(f));

    mockListenerRef.current!({ pitch: 440, confidence: 0.8, tCaptureMs: 1234 });
    expect(frames[0]).toEqual({ hz: 440, clarity: 0.8, timestampMs: 1234 });
  });

  test('treats a non-positive pitch as unvoiced (hz 0) and a missing confidence as clarity 0', async () => {
    const native = defaultNativePitch();
    const frames: PitchFrame[] = [];
    await native.start(CFG, (f) => frames.push(f));

    mockListenerRef.current!({ pitch: -1, confidence: 0.1, tCaptureMs: 2000 });
    expect(frames[0]).toEqual({ hz: 0, clarity: 0.1, timestampMs: 2000 });

    mockListenerRef.current!({ pitch: 330 } as Record<string, number>);
    expect(frames[1]).toMatchObject({ hz: 330, clarity: 0 });
    expect(typeof frames[1].timestampMs).toBe('number'); // falls back to Date.now()
  });

  test('has no permission API of its own (owned by the audio session) and returns true', async () => {
    const native = defaultNativePitch();
    await expect(native.requestPermission()).resolves.toBe(true);
  });

  test('stop removes the listener and stops the native module', async () => {
    const native = defaultNativePitch();
    await native.start(CFG, () => {});
    await native.stop();
    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockStop).toHaveBeenCalledTimes(1);
  });
});
