// The day's three challenges (spec 018). A pure function of the learner's local date, so the answer is the
// same for everyone on a date and for every request of it, and varies from day to day within what the
// library always allows: a warm-up (2–3 melodies), an accuracy goal (one melody at 85–95%) and a larger
// volume goal (4–6 melodies). Only the two types the app evaluates are used. Change the tables below and the
// next day's challenges change for everyone, with no app release.

export type ChallengeType = 'melodies' | 'accuracy';

export interface DailyChallenge {
  /** Unique within a day and stable for its content: the app keys payments by it. */
  id: string;
  type: ChallengeType;
  /** Melodies to complete, or the accuracy (percent) one melody must reach. */
  target: number;
  rewardXp: number;
  title: string;
  description: string;
}

export interface DailyChallenges {
  date: string;
  challenges: DailyChallenge[];
  /** Extra XP for finishing all three. */
  allBonusXp: number;
}

export const ALL_BONUS_XP = 25;

/** Target → XP of each slot. */
const WARM_UP: Record<number, number> = { 2: 10, 3: 15 };
const ACCURACY: Record<number, number> = { 85: 15, 90: 20, 95: 25 };
const VOLUME: Record<number, number> = { 4: 25, 5: 35, 6: 45 };

/** FNV-1a, 32 bit: a small, stable hash to seed the day's picks. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const pick = (date: string, slot: string, table: Record<number, number>): number => {
  const targets = Object.keys(table).map(Number);
  return targets[hash(`${date}:${slot}`) % targets.length];
};

/** `YYYY-MM-DD` and a real calendar day. */
export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function challengesFor(date: string): DailyChallenges {
  const warm = pick(date, 'warm-up', WARM_UP);
  const accuracy = pick(date, 'accuracy', ACCURACY);
  const volume = pick(date, 'volume', VOLUME);
  return {
    date,
    allBonusXp: ALL_BONUS_XP,
    challenges: [
      {
        id: `melodies-${warm}`,
        type: 'melodies',
        target: warm,
        rewardXp: WARM_UP[warm],
        title: `Complete ${warm} melodies`,
        description: `Play ${warm} melodies through`,
      },
      {
        id: `accuracy-${accuracy}`,
        type: 'accuracy',
        target: accuracy,
        rewardXp: ACCURACY[accuracy],
        title: `Reach ${accuracy}% accuracy`,
        description: `Land ${accuracy}% of the notes in one melody`,
      },
      {
        id: `melodies-${volume}`,
        type: 'melodies',
        target: volume,
        rewardXp: VOLUME[volume],
        title: `Complete ${volume} melodies`,
        description: `Keep going: ${volume} melodies today`,
      },
    ],
  };
}
