// The rules a tune must satisfy before it reaches learners (data-model.md). Pure.
import { MAX_MIDI, MIN_MIDI, parseNotes } from './notes.js';
import type { Tune, TuneInput } from './store.js';

const ID = /^[a-z0-9]{1,60}$/;
const SHA256 = /^[0-9a-f]{64}$/;

/** Problems with the owner's input; empty when it is acceptable. */
export function validateTuneInput(input: TuneInput): string[] {
  const errors: string[] = [];
  if (!ID.test(input.id)) errors.push('id must be 1–60 lowercase letters or digits (no hyphen)');
  if (!input.title.trim()) errors.push('title is required');
  if (!Number.isInteger(input.level) || input.level < 1 || input.level > 9) errors.push('level must be a whole number from 1 to 9');
  if (!(input.tempoBpm > 0) || input.tempoBpm > 400) errors.push('tempo must be above 0 and at most 400 BPM');
  if (input.phrases.length === 0 || input.phrases.some((n) => !Number.isInteger(n) || n < 1)) {
    errors.push('phrases must be a list of whole note counts, each at least 1');
  }
  const parsed = parseNotes(input.notes);
  if (!parsed || parsed.length === 0) {
    errors.push('notes must be "pitch:beats" tokens like "E4:1 D4:2"');
  } else {
    if (input.phrases.reduce((a, b) => a + b, 0) !== parsed.length) {
      errors.push(`phrases add up to ${input.phrases.reduce((a, b) => a + b, 0)} notes but the tune has ${parsed.length}`);
    }
    const out = parsed.filter((n) => n.midi < MIN_MIDI || n.midi > MAX_MIDI).length;
    if (out > 0) errors.push(`${out} note(s) are outside the fretboard (E2–E5)`);
  }
  return errors;
}

export function validateAudio(audio: { url: string; sha256: string; bytes: number }): string[] {
  const errors: string[] = [];
  if (!/^https:\/\//.test(audio.url)) errors.push('audio url must be https');
  if (!SHA256.test(audio.sha256)) errors.push('audio sha256 must be 64 lowercase hex characters');
  if (!Number.isInteger(audio.bytes) || audio.bytes <= 0) errors.push('audio size must be a positive number of bytes');
  return errors;
}

/** Whether learners may be offered this tune. */
export const isVisible = (t: Pick<Tune, 'hidden' | 'audioUrl' | 'audioSha256'>): boolean =>
  !t.hidden && t.audioUrl !== null && t.audioSha256 !== null;
