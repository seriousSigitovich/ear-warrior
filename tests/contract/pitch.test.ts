import { PitchFrame } from '../../src/models';
import {
  NativePitchModule,
  PitchDetectionConfig,
  createPitchDetector,
} from '../../src/services/audio/pitch';

const CFG: PitchDetectionConfig = { minHz: 80, maxHz: 1320, clarityThreshold: 0.5 };

function fakeNative(granted = true) {
  let captured: ((f: PitchFrame) => void) | null = null;
  const calls = { start: 0, stop: 0 };
  const native: NativePitchModule = {
    requestPermission: async () => granted,
    async start(_cfg, onFrame) {
      captured = onFrame;
      calls.start++;
    },
    async stop() {
      calls.stop++;
    },
  };
  return { native, calls, emit: (f: PitchFrame) => captured?.(f) };
}

describe('pitch detector wrapper (contracts/pitch-detection.md)', () => {
  test('start rejects when microphone permission is denied', async () => {
    const { native } = fakeNative(false);
    const det = createPitchDetector(native);
    await expect(det.start(CFG, () => {})).rejects.toThrow(/permission/);
    expect(det.isRunning()).toBe(false);
  });

  test('rejects a second start until stopped (detector already running)', async () => {
    const { native } = fakeNative(true);
    const det = createPitchDetector(native);
    await det.start(CFG, () => {});
    await expect(det.start(CFG, () => {})).rejects.toThrow(/already-running/);
  });

  test('passes silence/low-clarity frames through as-is', async () => {
    const { native, emit } = fakeNative(true);
    const det = createPitchDetector(native);
    const frames: PitchFrame[] = [];
    await det.start(CFG, (f) => frames.push(f));
    emit({ hz: 0, clarity: 0, timestampMs: 1 });
    emit({ hz: 330, clarity: 0.2, timestampMs: 2 });
    expect(frames).toEqual([
      { hz: 0, clarity: 0, timestampMs: 1 },
      { hz: 330, clarity: 0.2, timestampMs: 2 },
    ]);
  });

  test('stop releases native capture and clears running state', async () => {
    const { native, calls } = fakeNative(true);
    const det = createPitchDetector(native);
    await det.start(CFG, () => {});
    await det.stop();
    expect(calls.stop).toBe(1);
    expect(det.isRunning()).toBe(false);
    await det.stop(); // idempotent
    expect(calls.stop).toBe(1);
  });
});
