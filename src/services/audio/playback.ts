// Audio playback service (contracts/audio-playback.md). Notes are synthesized on the fly (no bundled
// samples): the native player renders a plucked-string tone per MIDI note into the cache dir and plays
// it via expo-audio. The native player is injected so orchestration (correct note per midi, in order,
// resolve-after-last, idempotent stop) stays contract-testable; the real binding is isolated in
// `defaultNativePlayer`.
import { PlaybackMelody } from '../../lib/schedule';
import { sampleManifest } from './samples';
import { renderNoteWav } from './synth';

export interface AudioPlayback {
  preload(midiNotes: number[]): Promise<void>;
  playMelody(m: PlaybackMelody): Promise<void>;
  playReferenceTone(midi: number): Promise<void>;
  stop(): Promise<void>;
}

/** Injectable native player: renders/plays a synthesized tone for one MIDI note and can stop output. */
export interface NativePlayer {
  /** Play the synthesized tone for `midi`, resolving after `durationMs`. */
  playTone(midi: number, durationMs: number): Promise<void>;
  /** Pre-generate tones so the first note of a melody starts without a synthesis hitch. */
  preloadTones(midis: number[]): Promise<void>;
  stopAll(): Promise<void>;
}

/** Tones are rendered at a generous fixed length so any note/reference duration fits the sample tail. */
const TONE_RENDER_MS = 2200;

/**
 * Legato overlap (Phase 0 musicality): playTone resolves after the note's hold (so scheduling and
 * total play time are unchanged), but the tone is left ringing for this much longer before its
 * player is released. The tail overlaps the next note's attack, connecting the line instead of the
 * abrupt cut-off that made the sequence sound like a string of isolated beeps.
 */
const RELEASE_TAIL_MS = 220;

/** Real adapter: synthesize each note to a cached WAV and play it through expo-audio. */
export function defaultNativePlayer(): NativePlayer {
  /* eslint-disable @typescript-eslint/no-explicit-any -- untyped native module handles */
  let audioMod: any;
  let fsMod: any;
  const active = new Set<any>(); // players still ringing out their release tail
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const audio = () => (audioMod ??= require('expo-audio'));
  const fs = () => (fsMod ??= require('expo-file-system'));
  const uriCache = new Map<number, string>();

  // Generate (once) a WAV tone for a MIDI note in the cache dir and return its file uri.
  const toneUri = (midi: number): string => {
    const cached = uriCache.get(midi);
    if (cached) return cached;
    const { File, Paths } = fs();
    const file = new File(Paths.cache, `tone-${midi}.wav`);
    if (!file.exists) {
      file.create({ overwrite: true });
      file.write(renderNoteWav(midi, TONE_RENDER_MS));
    }
    uriCache.set(midi, file.uri);
    return file.uri;
  };

  return {
    async preloadTones(midis) {
      for (const midi of midis) toneUri(midi); // materialize the WAV files ahead of playback
    },
    async playTone(midi, durationMs) {
      const player = audio().createAudioPlayer(toneUri(midi));
      active.add(player);
      player.play();
      // Release the player only after the tail so it overlaps the following note (legato).
      setTimeout(() => {
        active.delete(player);
        player.remove();
      }, durationMs + RELEASE_TAIL_MS);
      await new Promise((r) => setTimeout(r, durationMs));
    },
    async stopAll() {
      for (const player of active) player.remove();
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
    async playMelody(m) {
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
