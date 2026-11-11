import { rankProgress } from '../../../src/lib/gamification';
import { levelLabel, masteryRequirement } from '../../../src/lib/levelLabels';
import { CompletionResult, Snapshot } from '../../../src/services/gamification/service';
import { gameSummary } from '../../../src/services/gamification/summary';
import { allLevels } from '../../../src/services/melody/levels';

const LEVELS = allLevels().map((l) => l.id);

const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  totalXp: 120,
  rank: rankProgress(120, [LEVELS[0]]),
  mastery: [],
  today: '2026-11-10',
  challenges: [
    {
      id: 'a',
      title: '',
      description: '',
      progress: 3,
      target: 3,
      rewardXp: 10,
      completed: true,
      claimed: true,
    },
    {
      id: 'b',
      title: '',
      description: '',
      progress: 0,
      target: 1,
      rewardXp: 20,
      completed: false,
      claimed: false,
    },
  ],
  allChallengesDone: false,
  streak: { days: 4, practicedToday: true },
  activeDays: new Set(),
  ...over,
});

const result = (over: Partial<CompletionResult> = {}): CompletionResult => ({
  completion: {
    id: 'x',
    melodyId: 'm-1',
    level: LEVELS[0],
    accuracy: 90,
    hintsUsed: 0,
    completedAt: '',
    day: '2026-11-10',
  },
  masteryUnlocked: [],
  challengesCompleted: [],
  allChallengesBonus: 0,
  rankUp: null,
  totalXp: 120,
  rank: rankProgress(120, [LEVELS[0]]),
  streak: { days: 4, extended: false },
  ...over,
});

describe('melody summary', () => {
  test('nothing until the standing is known', () => {
    expect(gameSummary(30, result(), null)).toBeNull();
  });

  test('phrase XP, challenge rewards and the all-done bonus are added up and named', () => {
    const s = gameSummary(
      45,
      result({
        challengesCompleted: [
          { id: 'a', rewardXp: 10 },
          { id: 'b', rewardXp: 20 },
        ],
        allChallengesBonus: 25,
      }),
      snap(),
    );
    expect(s).toMatchObject({
      earnedXp: 100,
      parts: ['phrases +45', 'challenges +30', 'all challenges +25'],
      completed: true,
      challengesDone: 1,
      challengesTotal: 2,
      streakDays: 4,
    });
  });

  test('a melody below the pass mark still shows the phrases that paid', () => {
    const s = gameSummary(20, null, snap());
    expect(s).toMatchObject({
      earnedXp: 20,
      parts: ['phrases +20'],
      completed: false,
      masteryUnlocked: [],
    });
  });

  test('a level mastered with the melody is carried', () => {
    expect(
      gameSummary(0, result({ masteryUnlocked: [LEVELS[0]] }), snap())?.masteryUnlocked,
    ).toEqual([LEVELS[0]]);
  });
});

describe('level words', () => {
  test('a level is shown by its place on the ladder', () => {
    expect(levelLabel(LEVELS[0])).toBe('Level 1');
    expect(levelLabel(LEVELS[8])).toBe('Level 9');
    expect(levelLabel('nope')).toBe('nope');
  });

  test('a rank’s mastery requirement reads as a range', () => {
    expect(masteryRequirement([])).toBe('No mastery needed');
    expect(masteryRequirement(LEVELS.slice(0, 1))).toBe('Level 1');
    expect(masteryRequirement(LEVELS.slice(0, 4))).toBe('Levels 1–4');
    expect(masteryRequirement(LEVELS)).toBe('Levels 1–9');
    expect(masteryRequirement([LEVELS[0], LEVELS[2]])).toBe('Levels 1, 3');
  });
});
