import type * as KING from './story.mjs';
export interface TuneStory extends Pick<typeof KING, 'FPS' | 'DURATION' | 'MELODY' | 'BPM' | 'BEAT' | 'PHRASE' | 'STEP' | 'NOTE_RING' | 'T' | 'HEARD' | 'HOOK_NOTE'> {
  id: string; title: string; NOTES: string; MAX_FRET: number; CHORD: number[]; LET_RING: boolean; END_STRUM?: number[];
  /** The melody as written guitar music (king/tunes.mjs `score()`), drawn by src/rising/Staff.tsx in place of the beads. */
  SCORE?: { key: string; time: [number, number]; bars: ScoreNote[][] };
}
/** One written note: pitch as on the staff (an octave above the sound), duration, a tie into the next, and the melody note it sounds as. */
export interface ScoreNote { step: string; acc: '' | '#' | 'b'; octave: number; dur: '8' | 'q' | 'q.' | 'h' | 'h.' | 'w'; beats: number; tie: boolean; midi: number; order: number }
export const TUNES: Record<string, TuneStory>;
