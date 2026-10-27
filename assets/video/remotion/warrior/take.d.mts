import type { Story } from './story.mjs';
export function storyFromTake(take: { duration: number; onsets: { t: number; s: number }[]; chord?: number; bpm?: number; t0?: number }): Story;
