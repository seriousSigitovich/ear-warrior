import type * as KING from './story.mjs';
export interface TuneStory extends Pick<typeof KING, 'FPS' | 'DURATION' | 'MELODY' | 'BPM' | 'BEAT' | 'PHRASE' | 'STEP' | 'NOTE_RING' | 'T' | 'HEARD' | 'HOOK_NOTE'> {
  id: string; title: string; NOTES: string; MAX_FRET: number; CHORD: number[]; LET_RING: boolean; END_STRUM?: number[];
}
export const TUNES: Record<string, TuneStory>;
