// T021C (US1, FR-015): regression coverage for the capture window in src/features/practice/capture.ts.
// The logic shipped with T029 but was never tested — the ts-jest runner can't mount the React loop,
// yet `runCapture` is pure orchestration over an injected detector and is fully testable with fake
// timers. Guards: no-input timeout, voiced-frame arms the end-of-silence timer, each voiced frame
// re-arms it (hesitant playing is not cut off), timers are cleared on finish, and an early stop ends it.
import { PitchFrame } from '../../../src/models';
import { PitchDetectionConfig, PitchDetector } from '../../../src/services/audio/pitch';
import { CaptureConfig, CaptureHandle, runCapture } from '../../../src/features/practice/capture';

const PITCH_CFG: PitchDetectionConfig = { minHz: 80, maxHz: 1320, clarityThreshold: 0.5 };
const CAPTURE_CFG: CaptureConfig = { noInputTimeoutMs: 8000, endSilenceMs: 2000 };

const voiced = (timestampMs: number): PitchFrame => ({ hz: 440, clarity: 0.9, timestampMs });
const silent = (timestampMs: number): PitchFrame => ({ hz: 0, clarity: 0, timestampMs });
const lowClarity = (timestampMs: number): PitchFrame => ({ hz: 330, clarity: 0.2, timestampMs });

/** Detector fake: captures the frame callback so the test can drive frames by hand. */
function fakeDetector() {
  let onFrame: ((f: PitchFrame) => void) | null = null;
  const calls = { start: 0, stop: 0 };
  const detector: PitchDetector = {
    requestPermission: async () => true,
    async start(_cfg, cb) {
      onFrame = cb;
      calls.start += 1;
    },
    async stop() {
      calls.stop += 1;
    },
    isRunning: () => false,
  };
  return { detector, calls, emit: (f: PitchFrame) => onFrame?.(f) };
}

/** Drain the microtask queue so `runCapture`'s async `finish`/`onReady` settle under fake timers. */
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('runCapture window (FR-015)', () => {
  test('times out when no voiced frame arrives within noInputTimeoutMs', async () => {
    const { detector, calls, emit } = fakeDetector();
    const p = runCapture(detector, PITCH_CFG, CAPTURE_CFG);
    // Only unvoiced input: silence and a below-threshold frame never start the attempt.
    emit(silent(100));
    emit(lowClarity(200));
    jest.advanceTimersByTime(CAPTURE_CFG.noInputTimeoutMs);
    const res = await p;
    expect(res.timedOut).toBe(true);
    expect(calls.stop).toBe(1); // detector released exactly once
    expect(res.frames).toHaveLength(2); // frames are still collected, just not graded
  });

  test('a voiced frame starts the attempt and it ends after endSilenceMs of quiet', async () => {
    const { detector, emit } = fakeDetector();
    const p = runCapture(detector, PITCH_CFG, CAPTURE_CFG);
    emit(voiced(100)); // starts the attempt, arms the end-of-silence timer
    // Advancing well past the no-input timeout must NOT time out — the attempt already started.
    jest.advanceTimersByTime(CAPTURE_CFG.noInputTimeoutMs);
    const res = await p;
    expect(res.timedOut).toBe(false);
    expect(res.frames).toHaveLength(1);
  });

  test('each voiced frame re-arms the end timer, so hesitant pauses do not cut off the attempt', async () => {
    const { detector, emit } = fakeDetector();
    const p = runCapture(detector, PITCH_CFG, CAPTURE_CFG);
    let done = false;
    void p.then(() => {
      done = true;
    });

    emit(voiced(0)); // end timer would fire at 2000
    jest.advanceTimersByTime(1500);
    await flush();
    expect(done).toBe(false); // still within the window

    emit(voiced(1500)); // re-arm: end timer now fires at 3500, not 2000
    jest.advanceTimersByTime(1500); // reach 3000 — past the original 2000, before the new 3500
    await flush();
    expect(done).toBe(false); // proves the timer was re-armed, not left at 2000

    jest.advanceTimersByTime(500); // reach 3500 from the second frame
    const res = await p;
    expect(res.timedOut).toBe(false);
    expect(res.frames).toHaveLength(2);
  });

  test('timers are cleared on finish — no late stop or double resolve', async () => {
    const { detector, calls, emit } = fakeDetector();
    const p = runCapture(detector, PITCH_CFG, CAPTURE_CFG);
    emit(voiced(0));
    jest.advanceTimersByTime(CAPTURE_CFG.endSilenceMs); // ends on silence
    await p;
    const stopsAtFinish = calls.stop;
    jest.advanceTimersByTime(100000); // any lingering timer would fire here
    await flush();
    expect(calls.stop).toBe(stopsAtFinish); // exactly one release, no late finish
  });

  test('the learner can stop the attempt early via the capture handle', async () => {
    const { detector, emit } = fakeDetector();
    let handle: CaptureHandle | null = null;
    const p = runCapture(detector, PITCH_CFG, CAPTURE_CFG, {
      onReady: (h) => {
        handle = h;
      },
    });
    await flush(); // let start().then(onReady) run
    emit(voiced(0));
    (handle as unknown as CaptureHandle).stop(); // "Stop & check" before silence elapses
    const res = await p;
    expect(res.timedOut).toBe(false);
    expect(res.frames).toHaveLength(1);
  });
});
