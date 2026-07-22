# Contract: Pitch Detection Service

**Module**: `src/services/audio/pitch.ts` (wraps `react-native-pitchy`, YIN)
**Consumers**: `features/practice` (capturing state)

Turns microphone audio into a stream of monophonic pitch frames. Owns permission + native lifecycle;
does **not** grade or segment (segmentation lives in `src/lib`, see grading pipeline).

## Interface

```ts
interface PitchFrame {
  hz: number;          // detected fundamental; 0 when unvoiced
  clarity: number;     // 0–1 YIN confidence
  timestampMs: number; // monotonic capture time
}

interface PitchDetectionConfig {
  minHz: number;             // default ~80  (below E2 guard)
  maxHz: number;             // default ~1320 (above E6 guard)
  clarityThreshold: number;  // default tuned on-device (R2); frames below → treated as silence
}

interface PitchDetector {
  requestPermission(): Promise<boolean>;
  start(cfg: PitchDetectionConfig, onFrame: (f: PitchFrame) => void): Promise<void>;
  stop(): Promise<void>;      // tears down native capture
  isRunning(): boolean;
}
```

## Behavioral contract

- `start` MUST reject if microphone permission is denied (surface to UI, not a grading failure).
- Frames arrive at the library's native cadence; `hz===0` or `clarity < clarityThreshold` MUST be
  reported as-is (silence classification is the caller's/segmenter's job, kept pure).
- `stop` MUST fully release the audio input so subsequent `expo-av` playback is unaffected (R7).
- No frame buffering beyond what the native module provides; the caller collects frames per attempt.

## Error modes

| Condition | Contract |
|-----------|----------|
| Permission denied | `requestPermission → false`; `start` rejects with a typed error |
| Detector already running | `start` is a no-op-safe reject; caller must `stop` first |
| No voiced input for the attempt window | Emits only low-clarity/zero frames → caller detects timeout (FR-015) |

## Test intent (required — test-first)

Contract tests drive `pitch.ts` against a **mocked `react-native-pitchy`**, asserting permission
handling, silence/low-clarity pass-through, and clean teardown so playback is unaffected. The segmenter
(pure, `src/lib`) is unit-tested against recorded frame fixtures to yield the expected note sequence. The
native detector's real-world accuracy is additionally validated on-device.
