import type * as KING from './story.mjs';
export interface TuneStory extends Pick<typeof KING, 'FPS' | 'DURATION' | 'MELODY' | 'BPM' | 'BEAT' | 'PHRASE' | 'STEP' | 'NOTE_RING' | 'T' | 'HEARD' | 'HOOK_NOTE'> {
  id: string; title: string; NOTES: string; MAX_FRET: number; CHORD: number[]; LET_RING: boolean; END_STRUM?: number[];
  /** The opening hit as the key's chord, low string first, in place of HOOK_NOTE alone (HOOK_NOTE is then its root). */
  HOOK_CHORD?: { string: number; fret: number; midi: number }[];
  /** The hook's words: '97' (KingNeon), 'tabs' "can you play it without tabs?", 'guitarist' the same with "guitarists only · one listen" over it. */
  HOOK_TEXT: '97' | 'tabs' | 'guitarist' | 'byear';
  /** The last line: 'next' asks which song next, 'follow' asks to follow for the next tunes. */
  END_TEXT: 'next' | 'follow';
  /** The melody as written guitar music (king/tunes.mjs `score()`), drawn by src/rising/Staff.tsx in place of the beads. */
  /** A looping cut: no hook hit, melody from frame 0, the neck clears before the last frame. */
  LOOP?: boolean;
  /** "? ? ?" slots that fill as the notes sound (src/rising/RisingWood.tsx `Slots`), in place of the staff or beads. */
  SLOTS?: boolean;
  SCORE?: { key: string; time: [number, number]; bars: ScoreNote[][] };
}
/** One written note: pitch as on the staff (an octave above the sound), duration, a tie into the next, and the melody note it sounds as. */
export interface ScoreNote { step: string; acc: '' | '#' | 'b'; octave: number; dur: '16' | '8' | '8.' | '8t' | '16t' | 'q' | 'q.' | 'h' | 'h.' | 'w'; beats: number; tie: boolean; midi: number; order: number; rest?: boolean }
export const TUNES: Record<string, TuneStory>;
export const STRUM_GAP: number;
