import { hzFromMidi } from '../../../src/lib/pitchNote';
import {
  SAMPLE_RATE,
  encodeWav,
  pcm16FromFloat,
  renderNoteWav,
  renderPluckedString,
} from '../../../src/services/audio/synth';

const ascii = (bytes: Uint8Array, start: number, len: number) =>
  String.fromCharCode(...Array.from(bytes.slice(start, start + len)));

const readU32LE = (bytes: Uint8Array, at: number) =>
  bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24);

describe('runtime tone synthesis (generate-on-the-fly playback)', () => {
  test('renders the requested number of samples for a duration', () => {
    const samples = renderPluckedString(hzFromMidi(64), 500);
    expect(samples.length).toBe(Math.round((500 / 1000) * SAMPLE_RATE));
  });

  test('produces audible, bounded, non-silent output', () => {
    const samples = renderPluckedString(hzFromMidi(64), 300);
    let peak = 0;
    for (const s of samples) {
      expect(s).toBeGreaterThanOrEqual(-1);
      expect(s).toBeLessThanOrEqual(1);
      peak = Math.max(peak, Math.abs(s));
    }
    expect(peak).toBeGreaterThan(0.1); // not silence
  });

  test('is deterministic for a fixed seed', () => {
    const a = renderPluckedString(220, 100, SAMPLE_RATE, 123);
    const b = renderPluckedString(220, 100, SAMPLE_RATE, 123);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  test('applies a click-free attack and release envelope', () => {
    const samples = renderPluckedString(hzFromMidi(64), 300);
    expect(samples[0]).toBeCloseTo(0, 6); // silent first sample
    expect(samples[samples.length - 1]).toBeCloseTo(0, 6); // silent last sample
  });

  test('pcm16 clamps out-of-range floats', () => {
    const pcm = pcm16FromFloat(Float32Array.from([2, -2, 0]));
    expect(pcm[0]).toBe(0x7fff);
    expect(pcm[1]).toBe(-0x8000);
    expect(pcm[2]).toBe(0);
  });

  test('encodeWav writes a valid canonical WAV header', () => {
    const pcm = pcm16FromFloat(renderPluckedString(hzFromMidi(64), 100));
    const wav = encodeWav(pcm, SAMPLE_RATE);
    expect(ascii(wav, 0, 4)).toBe('RIFF');
    expect(ascii(wav, 8, 4)).toBe('WAVE');
    expect(ascii(wav, 36, 4)).toBe('data');
    expect(readU32LE(wav, 24)).toBe(SAMPLE_RATE); // sample rate
    expect(readU32LE(wav, 40)).toBe(pcm.length * 2); // data chunk length
    expect(wav.length).toBe(44 + pcm.length * 2);
  });

  test('renderNoteWav yields a playable WAV for a MIDI note', () => {
    const wav = renderNoteWav(64, 200);
    expect(ascii(wav, 0, 4)).toBe('RIFF');
    expect(wav.length).toBeGreaterThan(44);
  });
});
