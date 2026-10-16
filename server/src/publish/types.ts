export type PlatformName = 'youtube' | 'instagram';

/** A problem the owner can fix (bad file, over-long title, missing credential) — shown as plain text. */
export class PublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublishError';
  }
}
