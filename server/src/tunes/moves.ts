// The melodic moves of a tune, counted inside its phrases (a phrase's first note has none), by kind — what the app's
// "practise this kind of jump" picks tunes by. Only counts leave the server: they say nothing of the notes themselves.
// The kinds match the app's intervalKind (src/lib/insights.ts).
import { phraseMidis } from './notes.js';

export type IntervalSize = 'step' | 'third' | 'fourthFifth' | 'wide';
export type IntervalKind = 'repeat' | `${IntervalSize}:up` | `${IntervalSize}:down`;

export function intervalKind(semitones: number): IntervalKind {
  const size = Math.abs(semitones);
  if (size === 0) return 'repeat';
  const cls: IntervalSize = size <= 2 ? 'step' : size <= 4 ? 'third' : size <= 7 ? 'fourthFifth' : 'wide';
  return `${cls}:${semitones > 0 ? 'up' : 'down'}`;
}

export interface Moves {
  counts: Partial<Record<IntervalKind, number>>;
  total: number;
}

export function movesOf(notes: string, phrases: readonly number[]): Moves {
  const counts: Partial<Record<IntervalKind, number>> = {};
  let total = 0;
  for (const phrase of phraseMidis(notes, phrases) ?? []) {
    for (let i = 1; i < phrase.length; i++) {
      const kind = intervalKind(phrase[i] - phrase[i - 1]);
      counts[kind] = (counts[kind] ?? 0) + 1;
      total += 1;
    }
  }
  return { counts, total };
}
