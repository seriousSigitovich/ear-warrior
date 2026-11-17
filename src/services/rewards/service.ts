// The rewards service of the running app (spec 024): sends each phrase check to the server and hands back what it
// answers, keeps checks the server could not be asked (offline) and sends them in order later, asks the server for
// the standing, and remembers the last standing for the next launch. It decides nothing about XP, ranks or challenges.
import { dayKey } from '../../lib/streak';
import type { KeyValueStore } from '../../lib/deviceId';
import type { CheckQueue } from './checkQueue';
import { parseView, type RewardsClient } from './client';
import type { Identity } from './identity';
import type { LegacyPhrase } from './legacy';
import type {
  CheckInput,
  CheckOutcome,
  PhraseResult,
  QueuedCheck,
  RankRef,
  RewardsView,
} from './types';

export const VIEW_KEY = 'ew.rewards.view';

export interface RewardsService {
  /** Read the last standing from the device (so a screen can show something before the network answers). */
  init(): Promise<void>;
  /** One phrase check: the server's answer, or `queued` when it could not be reached. */
  check(input: CheckInput): Promise<CheckOutcome>;
  /** The first note of a phrase (recorded by the server); null when it cannot be had (offline). */
  hint(tuneId: string, phrase: number): Promise<number | null>;
  /** The whole phrase (recorded by the server); null when it cannot be had (offline). */
  answer(tuneId: string, phrase: number): Promise<number[] | null>;
  /** Send what the learner did before the server graded phrases (once; see legacy.ts). True once the server has it. */
  importLegacy(phrases: LegacyPhrase[]): Promise<boolean>;
  /** The standing as last known; null until the first answer from the server (or the device's copy). */
  view(): RewardsView | null;
  /** Ask the server for the standing now. */
  refresh(): Promise<RewardsView | null>;
  /** Send the checks that are waiting. */
  flush(): Promise<void>;
  /** How many checks are waiting to be sent. */
  pending(): Promise<number>;
  subscribe(listener: () => void): () => void;
  /** A queued check was answered (after the screen that made it may have gone). */
  onResult(listener: (checkId: string, result: PhraseResult) => void): () => void;
}

interface Deps {
  client: RewardsClient | null;
  identity: Identity;
  queue: CheckQueue;
  kv: KeyValueStore;
  now?: () => Date;
  newId?: () => string;
}

const randomId = () => `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

interface Stored {
  totalXp: number;
  rank: RewardsView['rank'];
  ranks: RankRef[];
  streakDays: number;
  today: string;
  activeDays: string[];
  challenges: RewardsView['challenges'];
  dailyBonusXp: number;
}

export function createRewardsService({
  client,
  identity,
  queue,
  kv,
  now = () => new Date(),
  newId = randomId,
}: Deps): RewardsService {
  let current: RewardsView | null = null;
  const listeners = new Set<() => void>();
  const resultListeners = new Set<(checkId: string, result: PhraseResult) => void>();
  let ranks: RankRef[] = [];

  function setView(view: RewardsView): void {
    current = { ...view, ranks: view.ranks.length > 0 ? view.ranks : ranks };
    if (view.ranks.length > 0) ranks = view.ranks;
    const stored: Stored = {
      totalXp: current.totalXp,
      rank: current.rank,
      ranks: current.ranks,
      streakDays: current.streak.days,
      today: current.today,
      activeDays: [...current.activeDays],
      challenges: current.challenges,
      dailyBonusXp: current.dailyBonusXp,
    };
    void kv.setItem(VIEW_KEY, JSON.stringify(stored)).catch(() => undefined);
    for (const l of [...listeners]) l();
  }

  // Sending is one run at a time, in order: a check must not overtake an earlier one.
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = chain.then(task, task);
    chain = run.catch(() => undefined);
    return run;
  };

  /** Checks answered during the current flush, by id, for the caller that is waiting on one of them. */
  const answered = new Map<string, PhraseResult | 'rejected'>();

  /** Run `use` with a token; if the server says the token is not valid, forget it and try once with a fresh identity. */
  async function withToken<T extends { kind: string }>(
    use: (token: string) => Promise<T>,
    unauthorized: T,
  ): Promise<T | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await identity.token();
      if (!token) return null;
      const out = await use(token);
      if (out.kind !== unauthorized.kind) return out;
      await identity.rejected(token);
    }
    return unauthorized;
  }

  async function flushNow(): Promise<void> {
    if (!client) return;
    for (const item of await queue.all()) {
      const out = await withToken((token) => client.check(token, item), {
        kind: 'unauthorized',
      } as Awaited<ReturnType<typeof client.check>>);
      if (!out || out.kind === 'offline' || out.kind === 'unauthorized') return; // keep it, and everything after it, for later
      await queue.remove(item.checkId);
      if (out.kind === 'rejected') {
        answered.set(item.checkId, 'rejected');
        continue;
      }
      answered.set(item.checkId, out.result);
      setView(out.result.view);
      for (const l of [...resultListeners]) l(item.checkId, out.result);
    }
  }

  const flush = () => serial(flushNow);

  return {
    async init() {
      try {
        const raw: unknown = JSON.parse((await kv.getItem(VIEW_KEY)) ?? 'null');
        if (typeof raw !== 'object' || raw === null) return;
        const s = raw as Stored;
        const view = parseView(
          {
            total_xp: s.totalXp,
            rank: {
              id: s.rank.id,
              name: s.rank.name,
              index: s.rank.index,
              next: s.rank.next,
              xp_to_next: s.rank.xpToNext,
              pct: s.rank.pct,
            },
            streak: { days: s.streakDays },
            active_days: s.activeDays,
            challenges: s.challenges.map((c) => ({
              id: c.id,
              title: c.title,
              description: c.description,
              progress: c.progress,
              target: c.target,
              reward_xp: c.rewardXp,
              completed: c.completed,
            })),
            daily_bonus_xp: s.dailyBonusXp,
          },
          s.today,
          s.ranks,
        );
        if (view && !current) {
          ranks = s.ranks ?? [];
          current = view;
          for (const l of [...listeners]) l();
        }
      } catch {
        // an unreadable copy is no copy
      }
    },

    async check(input) {
      const checkedAt = now();
      const item: QueuedCheck = {
        checkId: newId(),
        tuneId: input.tuneId,
        phrase: input.phrase,
        played: [...input.played],
        checkedAt: checkedAt.toISOString(),
        localDay: dayKey(checkedAt),
      };
      await queue.add(item); // kept first: a killed app or a dead network loses nothing
      await flush();
      const done = answered.get(item.checkId);
      answered.delete(item.checkId);
      if (done === 'rejected') return { kind: 'rejected' };
      return done ? { kind: 'graded', result: done } : { kind: 'queued', checkId: item.checkId };
    },

    async hint(tuneId, phrase) {
      if (!client) return null;
      const out = await withToken(
        async (token) => ({ kind: 'ok' as const, value: await client.hint(token, tuneId, phrase) }),
        { kind: 'unauthorized' as 'ok', value: null },
      );
      return out?.value ?? null;
    },

    async answer(tuneId, phrase) {
      if (!client) return null;
      const out = await withToken(
        async (token) => ({
          kind: 'ok' as const,
          value: await client.answer(token, tuneId, phrase),
        }),
        { kind: 'unauthorized' as 'ok', value: null as number[] | null },
      );
      return out?.value ?? null;
    },

    async importLegacy(phrases) {
      if (!client) return false;
      const out = await withToken(
        async (token) => ({ kind: 'ok' as const, done: await client.legacyImport(token, phrases) }),
        { kind: 'unauthorized' as 'ok', done: false },
      );
      return out?.done ?? false;
    },

    view: () => current,

    async refresh() {
      if (!client) return current;
      const today = dayKey(now());
      const out = await withToken(
        async (token) => {
          const res = await client.state(token, today);
          return res === 'unauthorized'
            ? { kind: 'unauthorized' as const }
            : { kind: 'ok' as const, res };
        },
        { kind: 'unauthorized' as const },
      );
      if (out && out.kind === 'ok' && out.res) setView(out.res.view);
      return current;
    },

    flush,

    async pending() {
      return (await queue.all()).length;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    onResult(listener) {
      resultListeners.add(listener);
      return () => resultListeners.delete(listener);
    },
  };
}
