// Runtime note synthesis (generate-on-the-fly playback). Instead of bundling pre-rendered per-note
// samples, we synthesize a plucked-string tone for any MIDI note at runtime using Karplus–Strong and
// encode it as a 16-bit mono WAV. This module is pure (no native, no IO) so it is fully unit-testable;
// the native tone provider in playback.ts writes the bytes to the cache dir and plays them.
import { hzFromMidi } from '../../lib/pitchNote';

/** Default render sample rate (Hz). CD-quality mono is plenty for a practice tone. */
export const SAMPLE_RATE = 44100;

/**
 * Synthesize a plucked-string tone via the Karplus–Strong algorithm.
 * Returns floating-point samples in [-1, 1]. Deterministic given `rngSeed` so tests are stable.
 */
export function renderPluckedString(
  hz: number,
  durationMs: number,
  sampleRate: number = SAMPLE_RATE,
  rngSeed = 0x9e3779b9,
): Float32Array {
  const total = Math.max(1, Math.round((durationMs / 1000) * sampleRate));
  const n = Math.max(2, Math.round(sampleRate / hz)); // delay-line length ≈ one period
  const buf = new Float32Array(n);

  // Seed the delay line with a short burst of white noise (the "pluck").
  let state = rngSeed >>> 0;
  const rand = () => {
    // xorshift32 → deterministic [-1, 1)
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 0xffffffff) * 2 - 1;
  };
  for (let i = 0; i < n; i++) buf[i] = rand();

  const out = new Float32Array(total);
  const decay = 0.996; // <1 shortens sustain; keeps a natural guitar-like tail
  let idx = 0;
  for (let i = 0; i < total; i++) {
    const cur = buf[idx];
    const next = buf[(idx + 1) % n];
    out[i] = cur;
    // Low-pass average of two adjacent samples + slight decay = the KS string update.
    buf[idx] = 0.5 * (cur + next) * decay;
    idx = (idx + 1) % n;
  }

  applyEnvelope(out, sampleRate);
  return out;
}

/** Short attack + tail fade so the note starts and ends without clicks. */
function applyEnvelope(samples: Float32Array, sampleRate: number): void {
  const attack = Math.min(samples.length, Math.round(0.005 * sampleRate)); // 5 ms
  const release = Math.min(samples.length, Math.round(0.03 * sampleRate)); // 30 ms
  for (let i = 0; i < attack; i++) samples[i] *= i / attack;
  for (let i = 0; i < release; i++) {
    samples[samples.length - 1 - i] *= i / release;
  }
}

/** Convert floating-point [-1, 1] samples to signed 16-bit PCM. */
export function pcm16FromFloat(samples: Float32Array): Int16Array {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = Math.round(s < 0 ? s * 0x8000 : s * 0x7fff);
  }
  return pcm;
}

/** Encode signed 16-bit mono PCM as a canonical little-endian WAV byte stream. */
export function encodeWav(pcm: Int16Array, sampleRate: number = SAMPLE_RATE): Uint8Array {
  const bytesPerSample = 2;
  const dataLen = pcm.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLen);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataLen, true); // chunk size
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // subchunk1 size (PCM)
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, 1, true); // channels = mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  view.setUint16(32, bytesPerSample, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(36, 'data');
  view.setUint32(40, dataLen, true);

  for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, pcm[i], true);
  return new Uint8Array(buffer);
}

/** Render a MIDI note straight to WAV bytes — the single call the native tone provider needs. */
export function renderNoteWav(
  midi: number,
  durationMs: number,
  sampleRate: number = SAMPLE_RATE,
): Uint8Array {
  const samples = renderPluckedString(hzFromMidi(midi), durationMs, sampleRate);
  return encodeWav(pcm16FromFloat(samples), sampleRate);
}
