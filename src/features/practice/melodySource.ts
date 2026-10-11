// Where melodies come from in this build (FR-021). The generator is off in this version: the MVP plays
// a curated set. `EXPO_PUBLIC_MELODY_SOURCE=generator` turns the generator back on, unchanged.
import { DifficultyLevel, Melody } from '../../models';
import { generateMelody } from '../../services/melody/generator';
import { curatedMelody } from '../../services/melody/curated';

export type MelodySource = 'curated' | 'generator';

/** Parse `EXPO_PUBLIC_MELODY_SOURCE`: only an explicit `generator` brings the generator back. */
export function resolveMelodySource(flag: string | undefined): MelodySource {
  return flag === 'generator' ? 'generator' : 'curated';
}

export const MELODY_SOURCE: MelodySource = resolveMelodySource(
  process.env.EXPO_PUBLIC_MELODY_SOURCE,
);

/** The melody picker the practice loop is given for this build. */
export const nextMelody: (level: DifficultyLevel, seed: number) => Melody =
  MELODY_SOURCE === 'generator' ? generateMelody : curatedMelody;
