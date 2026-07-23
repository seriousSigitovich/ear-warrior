# Contract: Audio Playback Service

**Module**: `src/services/audio/playback.ts` (plays runtime-synthesized tones via `expo-audio`)
**Consumers**: `features/practice` (playingMelody state), tuning reference (R5)

Plays a target `Melody` by **synthesizing a plucked-string tone per note at runtime** (Karplus–Strong,
`src/services/audio/synth.ts`), caching each as a WAV, and sequencing playback with `expo-audio`. Also
plays single reference tones for tuning. **No audio samples are bundled** (R6).

## Interface

```ts
interface PlaybackMelody {
  notes: { midi: number; startMs: number; durationMs: number }[]; // scheduled from tempo/durations
}

interface AudioPlayback {
  preload(midiNotes: number[]): Promise<void>; // synthesize + cache the active difficulty's note pool
  playMelody(m: PlaybackMelody): Promise<void>; // resolves when the last note has finished
  playReferenceTone(midi: number): Promise<void>;
  stop(): Promise<void>;
}
```

The native side is an injectable `NativePlayer` (`playTone` / `preloadTones` / `stopAll`) so orchestration
is contract-testable without `expo-audio`; the real adapter renders each tone to the cache dir and plays
it. The pure synth (`renderNoteWav`, KS + WAV encoding) is unit-tested independently.

## Behavioral contract

- Each melody note is **synthesized on demand keyed by `midi`**; a note outside the playable **E2–E6**
  range is a caller error surfaced at `preload` (throws — the range guard in `samples.ts`), never a
  silent skip or partial playback.
- `playMelody` MUST schedule notes by `startMs` and resolve only after the final note completes, so the
  practice loop can transition `playingMelody → awaitingInput` deterministically (US1 scenario 1).
- Replaying the same `Melody` MUST produce identical audio (US1 scenario 4). Synthesis is deterministic
  (fixed RNG seed), so re-rendering a note yields byte-identical output.
- `preload` SHOULD be called on difficulty change so the first note plays without a synthesis hitch
  (Performance target); cached tones are reused across plays.
- Playback MUST finish and release output before pitch capture starts (R7); `stop` is idempotent.

## Error modes

| Condition | Contract |
|-----------|----------|
| Note outside E2–E6 | Throws at `preload` (range guard); caught in dev + surfaced, never partial playback |
| Playback interrupted (call/route change) | `stop` cleans up; caller returns loop to a safe state |

## Test intent (required — test-first)

Sequencing math (tempo/durations → `startMs`) and the synth (KS render → WAV bytes) are pure and
unit-tested. Playback orchestration is contract-tested against a **mocked `NativePlayer`**: correct note
selected per `midi`, notes played in order, `playMelody` resolves only after the last note, and `stop` is
idempotent. Synthesized-tone audio fidelity is verified on-device.
