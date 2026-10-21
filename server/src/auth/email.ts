// Email normalisation shared by every auth route. Mirrors src/lib/email.ts in the app, so the
// screen rejects what the server would reject before any request is made.
const SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (raw: string): string => raw.trim().toLowerCase();

export const isPlausibleEmail = (email: string): boolean => email.length <= 320 && SHAPE.test(email);
