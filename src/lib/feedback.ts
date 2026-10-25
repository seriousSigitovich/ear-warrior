// "Write to us" mail link for Settings. Pure so it is testable without React Native; the screen only
// opens the URL. Same contact address as landing/privacy.

export const FEEDBACK_EMAIL = 'golovsha@gmail.com';

export interface FeedbackContext {
  platform: string;
  osVersion: string | number;
  /** The anonymous install id (R9), so a report can be matched to the usage events. Null if not read yet. */
  deviceId: string | null;
}

/** mailto: link with a subject and a body that leaves room for the message and carries the context. */
export function buildFeedbackUrl({ platform, osVersion, deviceId }: FeedbackContext): string {
  const body = [
    '',
    '',
    '— — —',
    'Please write above this line. The details below help us find the problem.',
    `Platform: ${platform} ${osVersion}`,
    `Device: ${deviceId ?? 'unknown'}`,
  ].join('\n');
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Ear Warrior feedback')}&body=${encodeURIComponent(body)}`;
}
