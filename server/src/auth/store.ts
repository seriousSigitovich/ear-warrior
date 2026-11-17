// Persistence seam of the auth routes. Two implementations satisfy the same contract
// (store.contract.ts): Postgres in production (pgStore.ts) and memory in route tests (memoryStore.ts).
// Every rule that must hold under concurrency (attempt counting, single use) is one atomic method here.

export interface CodeRow {
  id: string;
  email: string;
  codeHash: string;
  createdAt: Date;
  expiresAt: Date;
  attempts: number;
  usedAt: Date | null;
  supersededAt: Date | null;
}

export interface SessionInfo {
  userId: string;
  /** Null for an anonymous (device-only) account, spec 024. */
  email: string | null;
  deviceId: string;
}

export interface AuthStore {
  /** When codes were requested for this address / from this source since `since` (the rate-limit input). */
  requestTimes(email: string, sourceHash: string, since: Date): Promise<{ email: Date[]; source: Date[] }>;
  /** Supersedes the address's older active codes, stores the new one, returns its id. */
  issueCode(input: { email: string; codeHash: string; sourceHash: string; now: Date; expiresAt: Date }): Promise<string>;
  /** Removes a code that was never delivered (mail failed). */
  discardCode(id: string): Promise<void>;
  purgeCodesBefore(cutoff: Date): Promise<void>;
  /** The newest code of the address, whatever its state. */
  latestCode(email: string): Promise<CodeRow | null>;
  /** Counts one try: attempts + 1 if the code is unused, not superseded and under `max`. Returns the new count, or null if refused. */
  takeAttempt(id: string, max: number): Promise<number | null>;
  /** Marks the code used. True exactly once. */
  consumeCode(id: string, now: Date): Promise<boolean>;
  /** One transaction: find-or-create the user, close the device's link to anyone else, open a link, store the session. */
  signIn(input: { email: string; deviceId: string; tokenHash: string; now: Date }): Promise<{ userId: string; created: boolean }>;
  /**
   * Spec 024: a device-only identity. Finds the anonymous account that already has a session on this device, or
   * creates one (no email, no device link: attribution of events stays with real accounts), and stores a session for it.
   */
  anonymousSession(input: { deviceId: string; tokenHash: string; now: Date }): Promise<{ userId: string; created: boolean }>;
  /** The anonymous account that has had a session on this device, other than `exceptUserId`; null when none. */
  anonymousUserOf(deviceId: string, exceptUserId: string): Promise<string | null>;
  sessionByToken(tokenHash: string): Promise<SessionInfo | null>;
  /** Revokes the session and closes the device's open link to its user. Unknown or revoked tokens are a no-op. */
  signOut(tokenHash: string, now: Date): Promise<void>;
  /** Removes the user, their sessions, device links and the login codes of their address, atomically. */
  deleteUser(userId: string): Promise<void>;
  /** Same by address (owner CLI). False when there is no such account. */
  deleteUserByEmail(email: string): Promise<boolean>;
  /** Spec 022: stores a one-time hand-over of a Google-verified email (only the ticket's hash is kept). */
  issueGoogleTicket(input: { ticketHash: string; email: string; challenge: string; now: Date; expiresAt: Date }): Promise<void>;
  /** Marks the ticket used and returns what it carries; null when unknown, already used or expired. Atomic: true exactly once. */
  takeGoogleTicket(ticketHash: string, now: Date): Promise<{ email: string; challenge: string } | null>;
  purgeGoogleTicketsBefore(cutoff: Date): Promise<void>;
  /** Reference implementation of the attribution rule (data-model.md): whose is an event of `deviceId` at `at`? */
  attributedEmail(deviceId: string, at: Date): Promise<string | null>;
}
