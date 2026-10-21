// The numbers of spec 005 (FR-005/006/007) in one place; tests and routes import them, nothing hard-codes them.
export const CODE_TTL_S = 10 * 60;
export const MAX_ATTEMPTS = 5;
export const RESEND_AFTER_S = 60;
export const EMAIL_REQUESTS_PER_HOUR = 5;
export const SOURCE_REQUESTS_PER_HOUR = 20;
export const WINDOW_S = 60 * 60;
/** Login-code rows older than this are deleted on the next request (they only serve the limits). */
export const CODE_RETENTION_S = 24 * 60 * 60;
