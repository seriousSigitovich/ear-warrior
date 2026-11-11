// The device's copy of where the learner stopped in each melody (spec 017): one row per tune in the local
// store, with an unsent flag. Everything here is local and instant; talking to the server is melodySync's job.
import { MelodyPlaceRow, PhraseSave, placeOf } from '../../lib/melodyProgress';
import { MELODY_PROGRESS_TABLE, RowStore } from '../storage/db';

export interface MelodyProgressRepository {
  /** Save the place after a first-try check: `grades` are the answered phrases so far. */
  save(tuneId: string, phrases: number, grades: PhraseSave[]): Promise<void>;
  /** The melody was finished: forget the place, and remember to tell the server. */
  clear(tuneId: string): Promise<void>;
  get(tuneId: string): Promise<MelodyPlaceRow | null>;
  /** Places to show, tunes in any order (finished ones are not). */
  all(): Promise<MelodyPlaceRow[]>;
  /** Changes the server does not have yet, finished melodies included. */
  pending(): Promise<MelodyPlaceRow[]>;
  /** Every row, finished melodies' marks included (what a merge with the server reads). */
  everything(): Promise<MelodyPlaceRow[]>;
  /** Replace or add rows (as read from the server). */
  write(rows: readonly MelodyPlaceRow[]): Promise<void>;
  remove(tuneIds: readonly string[]): Promise<void>;
  /** The server has this exact change: mark it, unless the row has changed meanwhile. A finished melody is dropped. */
  markSynced(tuneId: string, updatedAt: string): Promise<void>;
}

const asRecord = (row: MelodyPlaceRow) => row as unknown as Record<string, unknown>;

export function createMelodyProgressRepository(
  store: RowStore,
  now: () => Date = () => new Date(),
): MelodyProgressRepository {
  const rows = () => store.all<MelodyPlaceRow>(MELODY_PROGRESS_TABLE);
  return {
    async save(tuneId, phrases, grades) {
      const row = placeOf(tuneId, phrases, grades, now());
      await store.insert(MELODY_PROGRESS_TABLE, tuneId, asRecord(row));
    },

    async clear(tuneId) {
      const row: MelodyPlaceRow = {
        tuneId,
        phrase: 0,
        phrases: 1,
        grades: [],
        updatedAt: now().toISOString(),
        deleted: true,
        synced: false,
      };
      await store.insert(MELODY_PROGRESS_TABLE, tuneId, asRecord(row));
    },

    async get(tuneId) {
      const row = await store.getById<MelodyPlaceRow>(MELODY_PROGRESS_TABLE, tuneId);
      return row && !row.deleted ? row : null;
    },

    async all() {
      return (await rows()).filter((r) => !r.deleted);
    },

    async pending() {
      return (await rows()).filter((r) => !r.synced);
    },

    everything: rows,

    async write(list) {
      for (const row of list) await store.insert(MELODY_PROGRESS_TABLE, row.tuneId, asRecord(row));
    },

    async remove(tuneIds) {
      // The store has no delete: a removed place is a finished one that the server already knows about, so the
      // row becomes an acknowledged mark that no screen shows and no sync sends.
      for (const id of tuneIds) {
        const row = await store.getById<MelodyPlaceRow>(MELODY_PROGRESS_TABLE, id);
        if (row)
          await store.insert(
            MELODY_PROGRESS_TABLE,
            id,
            asRecord({ ...row, deleted: true, synced: true }),
          );
      }
    },

    async markSynced(tuneId, updatedAt) {
      const row = await store.getById<MelodyPlaceRow>(MELODY_PROGRESS_TABLE, tuneId);
      if (!row || row.updatedAt !== updatedAt) return;
      await store.insert(MELODY_PROGRESS_TABLE, tuneId, asRecord({ ...row, synced: true }));
    },
  };
}
