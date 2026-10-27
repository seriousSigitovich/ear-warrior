// First-run onboarding: three short screens (listen → find it on the fretboard → get told exactly what
// landed), shown once. Pure content + the persisted "seen" flag over an injected key-value store.
import type { KeyValueStore } from './deviceId';

export const ONBOARDED_KEY = 'ew.onboarded';

export interface OnboardingStep {
  kicker: string;
  title: string;
  body: string;
}

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    kicker: 'Step 1 · Listen',
    title: 'A short melody plays',
    body: 'A few notes, played once. Hum them, tap them on your leg — whatever helps you hold them in your head.',
  },
  {
    kicker: 'Step 2 · Find it',
    title: 'Find it on the fretboard',
    body: 'Tap the notes where you think they live on the neck. Every tap sounds, so your ear can check your hand.',
  },
  {
    kicker: 'Step 3 · Hear the verdict',
    title: 'We show which notes landed',
    body: 'You see exactly which notes matched and which did not, then try again. Short rounds, level by level.',
  },
];

export async function isOnboarded(kv: KeyValueStore): Promise<boolean> {
  return (await kv.getItem(ONBOARDED_KEY)) === '1';
}

export async function markOnboarded(kv: KeyValueStore): Promise<void> {
  await kv.setItem(ONBOARDED_KEY, '1');
}
