// Audio playback service (contracts/audio-playback.md). Sequences pre-rendered per-note samples via
// expo-audio (expo-av's successor; migration anticipated in research R6). The native player is injected
// so orchestration (correct sample per midi, resolve-after-last, idempotent stop) is contract-testable;
// the real expo-audio binding is isolated in `defaultNativePlayer`.
import { PlaybackMelody } from '../../lib/schedule';
import { sampleFileForMidi, sampleManifest } from './samples';

export interface AudioPlayback {
  preload(midiNotes: number[]): Promise<void>;
  playMelody(m: PlaybackMelody): Promise<void>;
  playReferenceTone(midi: number): Promise<void>;
  stop(): Promise<void>;
}

/** Injectable native player: plays one already-scheduled note and can stop all output. */
export interface NativePlayer {
  /** Play the sample for `file`, resolving when it finishes (or after `durationMs`). */
  playSample(file: string, durationMs: number): Promise<void>;
  preloadSamples(files: string[]): Promise<void>;
  stopAll(): Promise<void>;
}

/** Real expo-audio adapter (lazily required; never loaded under the pure-logic test runner). */
export function defaultNativePlayer(): NativePlayer {
  let audioMod: any;
  let assets: Record<string, number>;
  const audio = () => (audioMod ??= require('expo-audio'));
  const sampleAssets = () =>
    (assets ??= require('./sampleAssets.native').SAMPLE_ASSETS as Record<string, number>);
  return {
    async preloadSamples() {
      // expo-audio creates players on demand; explicit warm-up is optional.
    },
    async playSample(file, durationMs) {
      const player = audio().createAudioPlayer(sampleAssets()[file]);
      player.play();
      await new Promise((r) => setTimeout(r, durationMs));
      player.remove();
    },
    async stopAll() {
      // Players are released per-note in playSample; nothing global to release.
    },
  };
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Create a playback service over an injected native player (defaults to the real one). */
export function createAudioPlayback(native: NativePlayer = defaultNativePlayer()): AudioPlayback {
  return {
    async preload(midiNotes) {
      const manifest = sampleManifest(midiNotes); // throws on any missing sample
      await native.preloadSamples(Object.values(manifest));
    },
    async playMelody(m) {
      // Schedule each note by startMs; resolve only after the final note completes.
      let cursor = 0;
      for (const note of m.notes) {
        if (note.startMs > cursor) {
          await wait(note.startMs - cursor);
          cursor = note.startMs;
        }
        await native.playSample(sampleFileForMidi(note.midi), note.durationMs);
        cursor += note.durationMs;
      }
    },
    async playReferenceTone(midi) {
      await native.playSample(sampleFileForMidi(midi), 1500);
    },
    stop: () => native.stopAll(),
  };
}
