# Contract: Audio Playback Service

**Module**: `src/services/audio/playback.ts` (wraps `expo-av`)
**Consumers**: `features/practice` (playingMelody state), tuning reference (R5)

Plays a target `Melody` by sequencing **pre-rendered per-note samples** bundled in `assets/samples/`,
and plays single reference tones for tuning.

## Interface

```ts
interface PlaybackMelody {
  notes: { midi: number; startMs: number; durationMs: number }[]; // scheduled from tempo/durations
}

interface AudioPlayback {
  preload(midiNotes: number[]): Promise<void>; // warm the active difficulty's note pool
  playMelody(m: PlaybackMelody): Promise<void>; // resolves when the last note has finished
  playReferenceTone(midi: number): Promise<void>;
  stop(): Promise<void>;
}
```

## Behavioral contract

- Each melody note maps to exactly one bundled sample keyed by `midi`; a missing sample is a build-time
  asset error, never a silent skip.
- `playMelody` MUST schedule notes by `startMs` and resolve only after the final note completes, so the
  practice loop can transition `playingMelody → awaitingInput` deterministically (US1 scenario 1).
- Replaying the same `Melody` MUST produce identical audio (US1 scenario 4 — melody unchanged).
- `preload` SHOULD be called on difficulty change to avoid first-note latency (Performance target).
- Playback MUST finish and release output before pitch capture starts (R7); `stop` is idempotent.

## Error modes

| Condition | Contract |
|-----------|----------|
| Missing sample for a `midi` | Throw at load/preload; caught in dev + surfaced, never partial playback |
| Playback interrupted (call/route change) | `stop` cleans up; caller returns loop to a safe state |

## Test intent (required — test-first)

Sequencing math (tempo/durations → `startMs`) is pure and unit-tested. Playback orchestration is
contract-tested against a **mocked `expo-av`**: correct sample selected per `midi`, `playMelody`
resolves only after the last note, and `stop` is idempotent. Sample audio fidelity is verified on-device.
