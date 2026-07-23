// Note-range helpers. Playback no longer bundles pre-rendered samples — tones are synthesized on the
// fly (see synth.ts). These pure helpers still guard the playable E2–E6 range: `sampleManifest` is the
// range check used by `preload` (throws on any out-of-range note, never partial playback).
import { noteName } from '../../lib/pitchNote';
import { GUITAR_MAX_MIDI, GUITAR_MIN_MIDI } from '../../lib/pitchNote';

/** Canonical sample filename for a MIDI note, e.g. 64 → "e4.mp3". */
export function sampleFileForMidi(midi: number): string {
  return `${noteName(midi).toLowerCase().replace('#', 's')}.mp3`;
}

/** True when a MIDI note is inside the range for which samples are bundled (E2–E6). */
export function hasSample(midi: number): boolean {
  return midi >= GUITAR_MIN_MIDI && midi <= GUITAR_MAX_MIDI;
}

/**
 * Resolve the sample filenames for a set of notes, throwing on any missing sample
 * (a missing sample is a build-time asset error, never a silent skip — audio-playback contract).
 */
export function sampleManifest(midiNotes: number[]): Record<number, string> {
  const manifest: Record<number, string> = {};
  for (const midi of midiNotes) {
    if (!hasSample(midi)) {
      throw new Error(`No bundled sample for MIDI ${midi} (${noteName(midi)}); outside E2–E6.`);
    }
    manifest[midi] = sampleFileForMidi(midi);
  }
  return manifest;
}
