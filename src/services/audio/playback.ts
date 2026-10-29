// Audio playback service (contracts/audio-playback.md). Sound comes from bundled files, voiced offline
// (assets/guitar-rig/render_library.py): one clip per library tune and one sample per fretboard note.
// Nothing is synthesised at run time. The native player is injected so orchestration (correct note per
// midi, in order, resolve-after-last, idempotent stop) stays contract-testable; the real binding is
// isolated in `defaultNativePlayer`.
import { PlaybackMelody, totalDurationMs } from '../../lib/schedule';
import { sampleManifest } from './samples';

export interface AudioPlayback {
  preload(midiNotes: number[]): Promise<void>;
  /**
   * Play a melody. With the id of a bundled clip it plays as one file; without one (or when the clip is
   * missing) it falls back to the note samples, one per scheduled note.
   */
  playMelody(m: PlaybackMelody, clipId?: string): Promise<void>;
  playReferenceTone(midi: number): Promise<void>;
  stop(): Promise<void>;
}

/** Injectable native player: plays a bundled note sample or melody clip and can stop output. */
export interface NativePlayer {
  /** Play the sample for `midi`, resolving after `durationMs`. */
  playTone(midi: number, durationMs: number): Promise<void>;
  /** Play the bundled clip `clipId` and resolve after `durationMs`; false (nothing played) if there is none. */
  playClip(clipId: string, durationMs: number): Promise<boolean>;
  /** Check the samples for `midis` exist so a melody never starts and then runs out of notes. */
  preloadTones(midis: number[]): Promise<void>;
  stopAll(): Promise<void>;
}

/**
 * Legato overlap: playTone resolves after the note's hold (so scheduling and total play time are
 * unchanged), but the sample is left ringing for this much longer before its player is released. The
 * tail overlaps the next note's attack, connecting the line instead of cutting each note off.
 */
const RELEASE_TAIL_MS = 220;

/** A clip is released this long after its schedule ends, so its own ring-out is never cut. */
const CLIP_RELEASE_MS = 800;

/** Real adapter: play the bundled files through expo-audio. */
export function defaultNativePlayer(): NativePlayer {
  /* eslint-disable @typescript-eslint/no-explicit-any -- untyped native module handles */
  let audioMod: any;
  const active = new Set<any>(); // players still playing or ringing out
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const audio = () => (audioMod ??= require('expo-audio'));
  // Lazily required: the registry `require`s the audio files, which only Metro can resolve (not the
  // pure-logic test runner).
  const bundled = (): typeof import('./bundled') => require('./bundled');

  // `remove()` only drops the player from expo-audio's registry; the native ExoPlayer and its
  // AudioTrack are freed by `release()`. Without it each play leaks a track until GC, and Android
  // stops creating tracks (~40 per app) — playback goes silent partway through a session.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped native player handle
  const dispose = (player: any) => {
    try {
      player.remove();
      player.release();
    } catch {
      // already released
    }
  };

  /** Start `source` now; the player is released `releaseAfterMs` later. */
  const start = (source: number, releaseAfterMs: number) => {
    const player = audio().createAudioPlayer(source);
    active.add(player);
    player.play();
    setTimeout(() => {
      active.delete(player);
      dispose(player);
    }, releaseAfterMs);
  };

  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  return {
    async preloadTones(midis) {
      for (const midi of midis) {
        if (bundled().NOTE_CLIPS[midi] === undefined) throw new Error(`No bundled sample for MIDI ${midi}.`);
      }
    },
    async playTone(midi, durationMs) {
      const source = bundled().NOTE_CLIPS[midi];
      if (source === undefined) throw new Error(`No bundled sample for MIDI ${midi}.`);
      start(source, durationMs + RELEASE_TAIL_MS);
      await wait(durationMs);
    },
    async playClip(clipId, durationMs) {
      const source = bundled().MELODY_CLIPS[clipId];
      if (source === undefined) return false;
      start(source, durationMs + CLIP_RELEASE_MS);
      await wait(durationMs);
      return true;
    },
    async stopAll() {
      for (const player of active) dispose(player);
      active.clear();
    },
  };
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Create a playback service over an injected native player (defaults to the real one). */
export function createAudioPlayback(native: NativePlayer = defaultNativePlayer()): AudioPlayback {
  return {
    async preload(midiNotes) {
      sampleManifest(midiNotes); // range guard: throws on any note outside E2–E6
      await native.preloadTones(midiNotes);
    },
    async playMelody(m, clipId) {
      if (clipId && (await native.playClip(clipId, totalDurationMs(m)))) return;
      // Schedule each note by startMs; resolve only after the final note completes.
      let cursor = 0;
      for (const note of m.notes) {
        if (note.startMs > cursor) {
          await wait(note.startMs - cursor);
          cursor = note.startMs;
        }
        await native.playTone(note.midi, note.durationMs);
        cursor += note.durationMs;
      }
    },
    async playReferenceTone(midi) {
      await native.playTone(midi, 1500);
    },
    stop: () => native.stopAll(),
  };
}
