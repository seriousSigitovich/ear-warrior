// Session & Attempt repositories (T012, FR-012/FR-018). Typed CRUD over the RowStore port; completed
// records survive app restarts because the store is durable (SQLite on device).
import { Attempt, Session } from '../../models';
import { ATTEMPTS_TABLE, RowStore, SESSIONS_TABLE } from './db';

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
