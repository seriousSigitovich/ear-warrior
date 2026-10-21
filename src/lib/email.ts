// Email rules shared with the server (server/src/auth/email.ts): the sign-in screen rejects typos
// before any request is made, and a request the screen lets through is one the server accepts.
const SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (raw: string): string => raw.trim().toLowerCase();

export const isPlausibleEmail = (email: string): boolean =>
  email.length <= 320 && SHAPE.test(email);
