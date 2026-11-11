// Where a learner stopped in a melody (spec 017), as pure logic: the phrase to continue at, the place saved after
// each first-try check, and the merge of the server's places into the device's. The device keeps a row per tune
// with an unsent flag; a change waits there until the server has it, and the latest write wins by time on both sides.
import type { AttemptGrade, DetectedNote, NoteResult } from '../models';
import { hzFromMidi } from './pitchNote';

/** How one answered phrase went on its first try: enough to score the melody when it is finished later. */
export interface PhraseSave {
  noteResults: NoteResult[];
  /** The notes (MIDI) the learner answered with, in order. */
  answer: number[];
}

/** A place as the server holds it. */
export interface RemotePlace {
  tuneId: string;
  /** 0-based phrase to continue at. */
  phrase: number;
  phrases: number;
  grades: PhraseSave[];
  /** ISO time of the last change. */
  updatedAt: string;
}

/** A place as the device holds it. */
export interface MelodyPlaceRow extends RemotePlace {
  /** The melody was finished: kept until the server has been told, so it is not brought back. */
  deleted: boolean;
  /** The server has this exact change. */
  synced: boolean;
}

/**
 * The phrase to continue at: the first not yet answered. With every phrase answered but the melody not finished,
 * the last one, so Finish is one tap away.
 */
export function resumePhrase(answered: number, phrases: number): number {
  return Math.min(Math.max(0, answered), Math.max(0, phrases - 1));
}

/** The place to save after a first-try check: `grades` are the answered phrases so far. Not yet on the server. */
export function placeOf(
  tuneId: string,
  phrases: number,
  grades: PhraseSave[],
  now: Date,
): MelodyPlaceRow {
  return {
    tuneId,
    phrase: resumePhrase(grades.length, phrases),
    phrases,
    grades,
    updatedAt: now.toISOString(),
    deleted: false,
    synced: false,
  };
}

/** Where "Skip to phrase N" goes from phrase `current`: the saved phrase, and only when it is ahead. */
export function skipTarget(current: number, saved: number): number | null {
  return saved > current ? saved : null;
}

const time = (iso: string) => Date.parse(iso);

/**
 * What to do with the device's places after reading the server's: rows to write and tunes to drop. A change the
 * device has not sent yet always stays (sending it settles the order on the server); a synced place the server no
 * longer has was finished elsewhere.
 */
export function mergeRemote(
  local: readonly MelodyPlaceRow[],
  remote: readonly RemotePlace[],
): { write: MelodyPlaceRow[]; remove: string[] } {
  const mine = new Map(local.map((p) => [p.tuneId, p]));
  const write: MelodyPlaceRow[] = [];
  for (const r of remote) {
    const l = mine.get(r.tuneId);
    const newer = !l || time(r.updatedAt) > time(l.updatedAt);
    if (!l || (newer && (l.synced || l.deleted))) {
      write.push({ ...r, deleted: false, synced: true });
    }
  }
  const onServer = new Set(remote.map((r) => r.tuneId));
  const remove = local
    .filter((l) => l.synced && !l.deleted && !onServer.has(l.tuneId))
    .map((l) => l.tuneId);
  return { write, remove };
}

/** A saved first try as the grade the loop scores the melody from: right only when every note was. */
export function gradeFromSave(save: PhraseSave): AttemptGrade {
  return {
    noteResults: save.noteResults,
    verdict: save.noteResults.every((r) => r.status === 'matched') ? 'correct' : 'incorrect',
    confidence: 1,
    lowConfidence: false,
    timedOut: false,
  };
}

/** A saved answer as the detected notes the attempt keeps (the fretboard gives no timing, so none is kept). */
export function detectedFromSave(save: PhraseSave): DetectedNote[] {
  return save.answer.map((midi, index) => ({
    index,
    midi,
    frequencyHz: hzFromMidi(midi),
    centsOffset: 0,
    clarity: 1,
    startMs: 0,
    endMs: 0,
  }));
}

/** The loop's first tries (grade and answer per answered phrase) as the saves to store. */
export function savesFrom(
  grades: readonly AttemptGrade[],
  answers: readonly DetectedNote[][],
): PhraseSave[] {
  return grades.map((g, i) => ({
    noteResults: g.noteResults,
    answer: (answers[i] ?? []).map((d) => d.midi),
  }));
}
