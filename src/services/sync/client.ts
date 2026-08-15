// HTTP transport for game-history sync against the Ear Warrior Node/Postgres backend.
// Postgres is the durable source of truth; the local SQLite RowStore is an offline cache that
// pushes up its documents and pulls the server copy on a fresh install. Injected so it is testable.

/** One document as stored on the server: a RowStore row plus its addressing + version. */
export interface SyncDocument {
  collection: string;
  doc_id: string;
  data: Record<string, unknown>;
  updated_at: number;
}

export interface SyncClient {
  /** Push local documents; server keeps the newest by `updated_at`. Returns rows applied. */
  push(deviceId: string, documents: SyncDocument[]): Promise<number>;
  /** Pull documents changed since `sinceMs` (0 = everything) for this device. */
  pull(deviceId: string, sinceMs: number): Promise<SyncDocument[]>;
}

export const SYNC_PATH = '/api/sync';

/**
 * Real HTTP sync client. Returns null when no API base URL is configured, so a build without
 * `EXPO_PUBLIC_API_URL` simply never syncs rather than failing — the app stays fully offline.
 */
export function createSyncClient(baseUrl?: string): SyncClient | null {
  if (!baseUrl) return null;
  const endpoint = `${baseUrl.replace(/\/$/, '')}${SYNC_PATH}`;
  return {
    async push(deviceId, documents) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, documents }),
      });
      if (!res.ok) throw new Error(`sync push failed: ${res.status}`);
      const json = (await res.json()) as { applied?: number };
      return json.applied ?? 0;
    },
    async pull(deviceId, sinceMs) {
      const url = `${endpoint}?device_id=${encodeURIComponent(deviceId)}&since=${sinceMs}`;
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error(`sync pull failed: ${res.status}`);
      const json = (await res.json()) as { documents?: SyncDocument[] };
      return json.documents ?? [];
    },
  };
}
