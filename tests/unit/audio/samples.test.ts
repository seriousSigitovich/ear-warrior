import { hasSample, sampleFileForMidi, sampleManifest } from '../../../src/services/audio/samples';

describe('sample manifest (T025, audio-playback contract)', () => {
  test('derives a canonical filename per MIDI note', () => {
    expect(sampleFileForMidi(64)).toBe('e4.mp3'); // E4
    expect(sampleFileForMidi(61)).toBe('cs4.mp3'); // C#4 → "cs"
  });

  test('hasSample guards the bundled E2–E6 range', () => {
    expect(hasSample(40)).toBe(true);
    expect(hasSample(88)).toBe(true);
    expect(hasSample(39)).toBe(false);
  });

  test('sampleManifest maps valid notes and throws on a missing sample', () => {
    expect(sampleManifest([60, 64, 67])).toEqual({ 60: 'c4.mp3', 64: 'e4.mp3', 67: 'g4.mp3' });
    expect(() => sampleManifest([200])).toThrow();
  });
});
