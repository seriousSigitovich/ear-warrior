// Gamification configuration (spec 013): every number the reward system uses lives here and nowhere
// else, so rewards, ranks and criteria can be tuned without touching the rules or the screens.
// Level ids come from the app's own difficulty ladder, never from assumed integers.
import { allLevels } from '../services/melody/levels';

export interface RankDef {
  id: string;
  name: string;
  /** Total XP at which the rank can be reached. */
  requiredXp: number;
  /** Level ids that must be Mastered for the rank. */
  requiredMastery: readonly string[];
}

export interface ChallengeDef {
  id: string;
  /** `melodies`: melodies completed today. `accuracy`: one melody at or above `target` percent. */
  type: 'melodies' | 'accuracy';
  target: number;
  rewardXp: number;
  title: string;
  description: string;
}

export interface GamificationConfig {
  /** A phrase or melody counts as completed from this share of notes landed (percent). */
  passAccuracy: number;
  /** Per phrase: base, extra at 90% and extra at 100% of its notes landed. */
  phraseXp: { base: number; accuracy90: number; accuracy100: number };
  allChallengesBonus: number;
  mastery: {
    minCompleted: number;
    /** How many of the latest completions are averaged. */
    recentWindow: number;
    minRecentAverage: number;
    minWithoutHints: number;
  };
  ranks: readonly RankDef[];
  challenges: readonly ChallengeDef[];
}

const levelIds = allLevels().map((l) => l.id);
/** The first `n` levels of the ladder. */
const firstLevels = (n: number) => levelIds.slice(0, n);

export const GAMIFICATION: GamificationConfig = {
  passAccuracy: 80,
  phraseXp: { base: 10, accuracy90: 5, accuracy100: 5 },
  allChallengesBonus: 25,
  mastery: { minCompleted: 10, recentWindow: 5, minRecentAverage: 85, minWithoutHints: 3 },
  ranks: [
    { id: 'beginner', name: 'Beginner', requiredXp: 0, requiredMastery: [] },
    { id: 'apprentice', name: 'Apprentice', requiredXp: 100, requiredMastery: firstLevels(1) },
    { id: 'listener', name: 'Listener', requiredXp: 300, requiredMastery: firstLevels(2) },
    { id: 'musician', name: 'Musician', requiredXp: 700, requiredMastery: firstLevels(4) },
    { id: 'virtuoso', name: 'Virtuoso', requiredXp: 1500, requiredMastery: firstLevels(6) },
    { id: 'maestro', name: 'Maestro', requiredXp: 3000, requiredMastery: firstLevels(8) },
    { id: 'mozart', name: 'Mozart', requiredXp: 5000, requiredMastery: levelIds },
  ],
  challenges: [
    {
      id: 'practice',
      type: 'melodies',
      target: 3,
      rewardXp: 10,
      title: 'Complete 3 melodies',
      description: 'Play three melodies through',
    },
    {
      id: 'accuracy',
      type: 'accuracy',
      target: 90,
      rewardXp: 20,
      title: 'Reach 90% accuracy',
      description: 'Land 9 of 10 notes in one melody',
    },
    {
      id: 'consistency',
      type: 'melodies',
      target: 5,
      rewardXp: 35,
      title: 'Complete 5 melodies',
      description: 'Keep going: five melodies today',
    },
  ],
};
