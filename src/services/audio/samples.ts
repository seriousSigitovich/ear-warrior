// Pre-rendered note-sample manifest (T025). The mapping midi → asset filename is pure and testable;
// the actual asset modules are registered by Metro (require) in sampleAssets.native.ts on device.
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
