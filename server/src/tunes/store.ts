// Persistence seam of the melody library (spec 024), same shape as the other stores: Postgres in production
// (pgStore.ts), memory in tests (memoryStore.ts), one contract (store.contract.ts) for both.

export interface Tune {
  /** Hyphen-free id, `^[a-z0-9]{1,60}$`. */
  id: string;
  title: string;
  /** Difficulty level 1–9. */
  level: number;
  /** Quarter notes per minute. */
  tempoBpm: number;
  /** Notes per phrase, in order. */
  phrases: number[];
  /** The answer: "pitch:beats" tokens. Server only. */
  notes: string;
  scale: string;
  source: string;
  audioUrl: string | null;
  audioSha256: string | null;
  audioBytes: number | null;
  /** Not offered to learners. A tune can only be shown once it has audio. */
  hidden: boolean;
  updatedAt: Date;
}

/** What the owner supplies when creating or changing a tune; audio and visibility have their own calls. */
export type TuneInput = Pick<Tune, 'id' | 'title' | 'level' | 'tempoBpm' | 'phrases' | 'notes'> &
  Partial<Pick<Tune, 'scale' | 'source'>>;

export interface TuneAudio {
  url: string;
  sha256: string;
  bytes: number;
}

export interface TuneStore {
  get(id: string): Promise<Tune | null>;
  /** All tunes, easiest level first then by id; hidden ones only when asked. */
  list(opts?: { includeHidden?: boolean }): Promise<Tune[]>;
  /** Creates the tune (hidden, no audio) or changes its fields, keeping audio and visibility. */
  upsert(input: TuneInput, now: Date): Promise<Tune>;
  /** Sets the audio; the tune stays as hidden or shown as it was. Null when there is no such tune. */
  setAudio(id: string, audio: TuneAudio, now: Date): Promise<Tune | null>;
  /** Shows or hides; showing a tune without audio is refused (returns null). Null also when there is no such tune. */
  setHidden(id: string, hidden: boolean, now: Date): Promise<Tune | null>;
  remove(id: string): Promise<void>;
}
