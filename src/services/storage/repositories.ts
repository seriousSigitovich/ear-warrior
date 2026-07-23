// Session & Attempt repositories (T012, FR-012/FR-018). Typed CRUD over the RowStore port; completed
// records survive app restarts because the store is durable (SQLite on device).
import { Attempt, DifficultySettings, Melody, Session } from '../../models';
import { DEFAULT_DIFFICULTY_SETTINGS } from '../../features/difficulty/adapt';
import {
  ATTEMPTS_TABLE,
  DIFFICULTY_SETTINGS_TABLE,
  MELODIES_TABLE,
  RowStore,
  SESSIONS_TABLE,
} from './db';

export interface SessionRepository {
  create(session: Session): Promise<Session>;
  get(id: string): Promise<Session | null>;
  update(id: string, patch: Partial<Session>): Promise<void>;
  all(): Promise<Session[]>;
}

export interface AttemptRepository {
  create(attempt: Attempt): Promise<Attempt>;
  get(id: string): Promise<Attempt | null>;
  forSession(sessionId: string): Promise<Attempt[]>;
  all(): Promise<Attempt[]>;
}

/** Target melodies — keeps `Attempt.melodyId` resolvable and feeds US3's weak-area grouping. */
export interface MelodyRepository {
  /** Insert or replace; a retry re-saves the same melody rather than duplicating it. */
  save(melody: Melody): Promise<void>;
  get(id: string): Promise<Melody | null>;
  all(): Promise<Melody[]>;
}

/** Persisted difficulty state — a single row, so difficulty outlives any session (FR-011b). */
export interface DifficultySettingsRepository {
  /** Returns the stored settings, or the documented defaults on first launch. */
  load(): Promise<DifficultySettings>;
  save(settings: DifficultySettings): Promise<void>;
}

export function createSessionRepository(store: RowStore): SessionRepository {
  return {
    async create(session) {
      await store.insert(SESSIONS_TABLE, session.id, session as unknown as Record<string, unknown>);
      return session;
    },
    get: (id) => store.getById<Session>(SESSIONS_TABLE, id),
    update: (id, patch) => store.update(SESSIONS_TABLE, id, patch as Record<string, unknown>),
    all: () => store.all<Session>(SESSIONS_TABLE),
  };
}

export function createAttemptRepository(store: RowStore): AttemptRepository {
  return {
    async create(attempt) {
      await store.insert(ATTEMPTS_TABLE, attempt.id, attempt as unknown as Record<string, unknown>);
      return attempt;
    },
    get: (id) => store.getById<Attempt>(ATTEMPTS_TABLE, id),
    async forSession(sessionId) {
      const all = await store.all<Attempt>(ATTEMPTS_TABLE);
      return all.filter((a) => a.sessionId === sessionId);
    },
    all: () => store.all<Attempt>(ATTEMPTS_TABLE),
  };
}

export function createMelodyRepository(store: RowStore): MelodyRepository {
  return {
    save: (melody) =>
      store.insert(MELODIES_TABLE, melody.id, melody as unknown as Record<string, unknown>),
    get: (id) => store.getById<Melody>(MELODIES_TABLE, id),
    all: () => store.all<Melody>(MELODIES_TABLE),
  };
}

/** Fixed key for the singleton settings row — insert-or-replace keeps exactly one. */
const SETTINGS_ID = 'singleton';

export function createDifficultySettingsRepository(store: RowStore): DifficultySettingsRepository {
  return {
    async load() {
      const stored = await store.getById<DifficultySettings>(
        DIFFICULTY_SETTINGS_TABLE,
        SETTINGS_ID,
      );
      // Merge over the defaults so a row written by an older build that lacks a field still loads.
      return stored ? { ...DEFAULT_DIFFICULTY_SETTINGS, ...stored } : DEFAULT_DIFFICULTY_SETTINGS;
    },
    async save(settings) {
      await store.insert(
        DIFFICULTY_SETTINGS_TABLE,
        SETTINGS_ID,
        settings as unknown as Record<string, unknown>,
      );
    },
  };
}
