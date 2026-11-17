// The catalog the app serves from (spec 024): downloaded from the server (`GET /api/melodies`, answers never in it),
// kept on the device so the next launch starts from it, and replaced when the server says it changed. Until the first
// download the few tunes shipped inside the app stand. Never throws and never waits long: an offline or failing server
// leaves what the device already has.
import type { LibraryTune } from './types';
import type { KeyValueStore } from '../../lib/deviceId';

export const CATALOG_KEY = 'ew.tunes.catalog';
const TIMEOUT_MS = 8000;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isInt = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** One entry of the server's catalog as a tune, or null when it is not what the app expects (it is then left out). */
export function parseTune(raw: unknown): LibraryTune | null {
  if (!isObject(raw)) return null;
  const {
    id,
    title,
    level,
    tempo_bpm: tempo,
    phrases,
    beats,
    scale,
    moves,
    answer,
    audio_url: url,
    audio_sha256: sha,
    audio_bytes: bytes,
  } = raw;
  if (typeof id !== 'string' || !/^[a-z0-9]{1,60}$/.test(id) || typeof title !== 'string' || !title)
    return null;
  if (!isInt(level, 1, 9) || typeof tempo !== 'number' || !(tempo > 0)) return null;
  if (!Array.isArray(phrases) || phrases.length === 0 || !phrases.every((n) => isInt(n, 1)))
    return null;
  if (!Array.isArray(beats) || !beats.every((b) => typeof b === 'number' && b > 0)) return null;
  if (beats.length !== (phrases as number[]).reduce((a, b) => a + b, 0)) return null;
  if (
    typeof url !== 'string' ||
    !/^https:\/\//.test(url) ||
    typeof sha !== 'string' ||
    !/^[0-9a-f]{64}$/.test(sha)
  )
    return null;
  if (!isInt(bytes, 1)) return null;
  const counts =
    isObject(moves) && isObject(moves.counts)
      ? (moves.counts as LibraryTune['moves']['counts'])
      : {};
  const total = isObject(moves) && isInt(moves.total, 0) ? moves.total : 0;
  // An answer that does not fit the tune's rhythm is no answer: the tune is then graded by the server alone.
  const fits =
    Array.isArray(answer) &&
    answer.length === beats.length &&
    answer.every((m) => isInt(m, 28, 88));
  return {
    id,
    title,
    rank: level,
    tempoBpm: tempo,
    phrases: phrases as number[],
    beats: beats as number[],
    scale: typeof scale === 'string' ? scale : '',
    moves: { counts, total },
    ...(fits ? { answer: answer as number[] } : {}),
    audio: { sha256: sha, url, bytes },
  };
}

/** The tunes of a catalog answer; null when the answer is not a catalog at all. */
export function parseCatalog(raw: unknown): LibraryTune[] | null {
  if (!isObject(raw) || raw.ok !== true || !Array.isArray(raw.tunes)) return null;
  return raw.tunes.map(parseTune).filter((t): t is LibraryTune => t !== null);
}

interface Snapshot {
  etag: string;
  tunes: LibraryTune[];
}

export interface CatalogService {
  /** The tunes to start from: the stored catalog, else the ones shipped inside the app. */
  load(): Promise<LibraryTune[]>;
  /** Ask the server whether the catalog changed; true when a new one was stored (call `load` again). */
  refresh(): Promise<boolean>;
}

interface Deps {
  /** Backend base URL; without one the app only ever has its shipped tunes. */
  apiUrl: string | undefined;
  kv: KeyValueStore;
  fetchImpl?: typeof fetch;
  shipped: readonly LibraryTune[];
}

export function createCatalogService({
  apiUrl,
  kv,
  fetchImpl = fetch,
  shipped,
}: Deps): CatalogService {
  async function stored(): Promise<Snapshot | null> {
    try {
      const raw: unknown = JSON.parse((await kv.getItem(CATALOG_KEY)) ?? 'null');
      if (!isObject(raw) || typeof raw.etag !== 'string' || !Array.isArray(raw.tunes)) return null;
      const tunes = raw.tunes.map((t) => parseSaved(t)).filter((t): t is LibraryTune => t !== null);
      return tunes.length > 0 ? { etag: raw.etag, tunes } : null;
    } catch {
      return null;
    }
  }

  return {
    async load() {
      return (await stored())?.tunes ?? [...shipped];
    },

    async refresh() {
      if (!apiUrl) return false;
      try {
        const have = await stored();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          const res = await fetchImpl(`${apiUrl.replace(/\/$/, '')}/api/melodies`, {
            headers: have ? { 'If-None-Match': `"${have.etag}"` } : {},
            signal: controller.signal,
          });
          if (res.status === 304 || !res.ok) return false;
          const body: unknown = await res.json();
          const tunes = parseCatalog(body);
          const etag = isObject(body) && typeof body.etag === 'string' ? body.etag : '';
          if (!tunes || tunes.length === 0 || !etag) return false;
          if (have?.etag === etag) return false;
          await kv.setItem(CATALOG_KEY, JSON.stringify({ etag, tunes } satisfies Snapshot));
          return true;
        } finally {
          clearTimeout(timer);
        }
      } catch {
        return false;
      }
    },
  };
}

/** A tune as it was saved on the device (already in the app's shape). */
function parseSaved(raw: unknown): LibraryTune | null {
  if (!isObject(raw) || !isObject(raw.audio)) return null;
  const a = raw.audio;
  return parseTune({
    id: raw.id,
    title: raw.title,
    level: raw.rank,
    tempo_bpm: raw.tempoBpm,
    phrases: raw.phrases,
    beats: raw.beats,
    scale: raw.scale,
    moves: raw.moves,
    answer: raw.answer,
    audio_url: a.url,
    audio_sha256: a.sha256,
    audio_bytes: a.bytes,
  });
}
