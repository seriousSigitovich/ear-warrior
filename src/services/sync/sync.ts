// Sync orchestration between the local RowStore (offline cache) and the backend (source of truth).
// Kept free of React/native so it is unit-testable against the in-memory RowStore and a mock client.
//
// Collections synced: sessions, attempts, melodies, difficulty_settings. The device id (key_value)
// is intentionally local-only. All records carry a stable id in the row (or a fixed singleton id),
// so no RowStore changes are needed to address them.
import {
  ATTEMPTS_TABLE,
  DIFFICULTY_SETTINGS_TABLE,
  MELODIES_TABLE,
  RowStore,
  SESSIONS_TABLE,
} from '../storage/db';
import { SyncClient, SyncDocument } from './client';

/** Fixed doc id for the singleton difficulty settings row (mirrors repositories.ts). */
const DIFFICULTY_SINGLETON_ID = 'singleton';

/** Collections whose rows each carry their own `id`. */
const ID_COLLECTIONS = [SESSIONS_TABLE, ATTEMPTS_TABLE, MELODIES_TABLE] as const;

/** Read every syncable local document, tagging each with `updated_at = now` (this device is authoritative). */
export async function collectLocalDocuments(store: RowStore): Promise<SyncDocument[]> {
  const now = Date.now();
  const docs: SyncDocument[] = [];

  for (const collection of ID_COLLECTIONS) {
    const rows = await store.all<Record<string, unknown>>(collection);
    for (const row of rows) {
      const id = row.id;
      if (typeof id === 'string' && id.length > 0) {
        docs.push({ collection, doc_id: id, data: row, updated_at: now });
      }
    }
  }

  const difficulty = await store.getById<Record<string, unknown>>(
    DIFFICULTY_SETTINGS_TABLE,
    DIFFICULTY_SINGLETON_ID,
  );
  if (difficulty) {
    docs.push({
      collection: DIFFICULTY_SETTINGS_TABLE,
      doc_id: DIFFICULTY_SINGLETON_ID,
      data: difficulty,
      updated_at: now,
    });
  }

  return docs;
}

/** Write pulled server documents into the local store (used to hydrate a fresh install). */
export async function applyPulledDocuments(
  store: RowStore,
  documents: SyncDocument[],
): Promise<void> {
  for (const d of documents) {
    await store.insert(d.collection, d.doc_id, d.data);
  }
}

/** Push all local documents to the backend. Best-effort: never throws to the caller. */
export async function syncPush(
  store: RowStore,
  client: SyncClient,
  deviceId: string,
): Promise<number> {
  try {
    const docs = await collectLocalDocuments(store);
    if (docs.length === 0) return 0;
    return await client.push(deviceId, docs);
  } catch {
    return 0; // offline / failure → try again next time
  }
}

/** Pull server documents (since=0 by default) and hydrate the local store. Best-effort. */
export async function syncPull(
  store: RowStore,
  client: SyncClient,
  deviceId: string,
  sinceMs = 0,
): Promise<number> {
  try {
    const docs = await client.pull(deviceId, sinceMs);
    await applyPulledDocuments(store, docs);
    return docs.length;
  } catch {
    return 0;
  }
}
