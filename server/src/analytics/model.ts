// What the owner's analytics page knows about each person. One row per account (all of its devices folded
// together) or, for a guest, per device. Pure: the report query hands over plain facts, this file merges them,
// names the step a person stopped at and the status they are in. Tested without a database.

/** What app_events and attempt_log say about one install (see report.ts). Null times: the device never sent that event. */
export interface DeviceFacts {
  deviceId: string;
  /** The account the device was last linked to (an anonymous account counts); null when never linked. */
  userId: string | null;
  appVersion: string | null;
  /** True when the build sends `screen_view`; older installs are left out of the funnel so they do not read as "stopped at step 1". */
  tracked: boolean;
  firstAt: Date | null;
  lastAt: Date | null;
  /** Distinct UTC days with any event. */
  days: number;
  onboardingStep: number;
  onboardingDone: boolean;
  onboardingSkipped: boolean;
  onboardedAt: Date | null;
  signinSeen: boolean;
  codeRequested: boolean;
  signedIn: boolean;
  signedInAt: Date | null;
  signinErrors: string[];
  practiceOpened: boolean;
  melodyPlayed: boolean;
  firstMelodyAt: Date | null;
  answerStarted: boolean;
  answers: number;
  correct: number;
  firstAnswerAt: Date | null;
  /** Screen and practice phase of the last `app_background`. */
  leftScreen: string | null;
  leftPhase: string | null;
  sessions: number;
  sessionSeconds: number;
  maxRank: number | null;
  drafts: number;
  streak: number;
  rankUps: number;
  challengesDone: number;
  /** attempt_log: also covers builds older than the events. */
  attempts: number;
  attemptsCorrect: number;
  octaveMismatches: number;
  /** Attempts answered on the fretboard rather than the microphone. */
  fretboardAttempts: number;
  lastAttemptAt: Date | null;
}

/** The server-side account: reward ledger and phrase checks. */
export interface AccountFacts {
  userId: string;
  /** Typed by strangers — escape it. Null for a guest account. */
  email: string | null;
  anonymous: boolean;
  createdAt: Date;
  xp: number;
  phraseChecks: number;
  phrasesPassed: number;
  /** XP by the old rules: the sum of the award rows the app computed and pushed (spec 019). Zero for a guest. */
  oldXp: number;
  /** Where the app says the learner stopped in each tune (progress_melodies); phrases answered = `phrase` (0-based resume point). */
  legacyTunes: { tuneId: string; phrase: number; phrases: number }[];
}

export interface TuneFacts {
  userId: string;
  tuneId: string;
  checks: number;
  passed: number;
}

/** Row counts of the server-side tables, to tell "nobody has any" from "the page does not see them". */
export interface ServerTotals {
  xpRows: number;
  phraseChecks: number;
  accounts: number;
  guestAccounts: number;
  guestSessions: number;
}

export interface AnalyticsData {
  devices: DeviceFacts[];
  accounts: AccountFacts[];
  tunes: TuneFacts[];
  totals?: ServerTotals;
}

export interface AnalyticsUser {
  /** Account id, or `d:<deviceId>` for a guest device. */
  key: string;
  userId: string | null;
  email: string | null;
  deviceIds: string[];
  appVersion: string | null;
  tracked: boolean;
  createdAt: Date | null;
  firstAt: Date | null;
  lastAt: Date | null;
  days: number;
  onboardingStep: number;
  onboardingDone: boolean;
  onboardingSkipped: boolean;
  onboardedAt: Date | null;
  signinSeen: boolean;
  codeRequested: boolean;
  signedIn: boolean;
  signedInAt: Date | null;
  signinErrors: string[];
  practiceOpened: boolean;
  melodyPlayed: boolean;
  firstMelodyAt: Date | null;
  answerStarted: boolean;
  answers: number;
  correct: number;
  firstAnswerAt: Date | null;
  leftScreen: string | null;
  leftPhase: string | null;
  sessions: number;
  sessionSeconds: number;
  maxRank: number | null;
  drafts: number;
  streak: number;
  rankUps: number;
  challengesDone: number;
  attempts: number;
  attemptsCorrect: number;
  octaveMismatches: number;
  fretboardAttempts: number;
  xp: number;
  phraseChecks: number;
  phrasesPassed: number;
  oldXp: number;
  legacyTunes: { tuneId: string; phrase: number; phrases: number }[];
  /** Tunes by number of checks, most played first. */
  tunes: { tuneId: string; checks: number; passed: number }[];
}

const min = (a: Date | null, b: Date | null): Date | null => (a && b ? (a < b ? a : b) : (a ?? b));
const max = (a: Date | null, b: Date | null): Date | null => (a && b ? (a > b ? a : b) : (a ?? b));
const maxN = (a: number | null, b: number | null): number | null => (a !== null && b !== null ? Math.max(a, b) : (a ?? b));

function mergeDevices(key: string, userId: string | null, devices: DeviceFacts[]): AnalyticsUser {
  const latest = [...devices].sort((a, b) => (b.lastAt?.getTime() ?? 0) - (a.lastAt?.getTime() ?? 0))[0];
  const u: AnalyticsUser = {
    key,
    userId,
    email: null,
    deviceIds: devices.map((d) => d.deviceId),
    appVersion: latest?.appVersion ?? null,
    tracked: false,
    createdAt: null,
    firstAt: null,
    lastAt: null,
    days: 0,
    onboardingStep: 0,
    onboardingDone: false,
    onboardingSkipped: false,
    onboardedAt: null,
    signinSeen: false,
    codeRequested: false,
    signedIn: false,
    signedInAt: null,
    signinErrors: [],
    practiceOpened: false,
    melodyPlayed: false,
    firstMelodyAt: null,
    answerStarted: false,
    answers: 0,
    correct: 0,
    firstAnswerAt: null,
    leftScreen: latest?.leftScreen ?? null,
    leftPhase: latest?.leftPhase ?? null,
    sessions: 0,
    sessionSeconds: 0,
    maxRank: null,
    drafts: 0,
    streak: 0,
    rankUps: 0,
    challengesDone: 0,
    attempts: 0,
    attemptsCorrect: 0,
    octaveMismatches: 0,
    fretboardAttempts: 0,
    xp: 0,
    phraseChecks: 0,
    phrasesPassed: 0,
    oldXp: 0,
    legacyTunes: [],
    tunes: [],
  };
  const errors = new Set<string>();
  for (const d of devices) {
    u.tracked ||= d.tracked;
    u.firstAt = min(u.firstAt, d.firstAt);
    u.lastAt = max(max(u.lastAt, d.lastAt), d.lastAttemptAt);
    u.days = Math.max(u.days, d.days);
    u.onboardingStep = Math.max(u.onboardingStep, d.onboardingStep);
    u.onboardingDone ||= d.onboardingDone;
    u.onboardingSkipped ||= d.onboardingSkipped;
    u.onboardedAt = min(u.onboardedAt, d.onboardedAt);
    u.signinSeen ||= d.signinSeen;
    u.codeRequested ||= d.codeRequested;
    u.signedIn ||= d.signedIn;
    u.signedInAt = min(u.signedInAt, d.signedInAt);
    for (const e of d.signinErrors) errors.add(e);
    u.practiceOpened ||= d.practiceOpened;
    u.melodyPlayed ||= d.melodyPlayed;
    u.firstMelodyAt = min(u.firstMelodyAt, d.firstMelodyAt);
    u.answerStarted ||= d.answerStarted;
    u.answers += d.answers;
    u.correct += d.correct;
    u.firstAnswerAt = min(u.firstAnswerAt, d.firstAnswerAt);
    u.sessions += d.sessions;
    u.sessionSeconds += d.sessionSeconds;
    u.maxRank = maxN(u.maxRank, d.maxRank);
    u.drafts += d.drafts;
    u.streak = Math.max(u.streak, d.streak);
    u.rankUps += d.rankUps;
    u.challengesDone += d.challengesDone;
    u.attempts += d.attempts;
    u.attemptsCorrect += d.attemptsCorrect;
    u.octaveMismatches += d.octaveMismatches;
    u.fretboardAttempts += d.fretboardAttempts;
  }
  u.signinErrors = [...errors].sort();
  return u;
}

/** Fold devices, accounts and tune counts into one row per person, most recently seen first. */
export function buildUsers(data: AnalyticsData): AnalyticsUser[] {
  const byAccount = new Map<string, DeviceFacts[]>();
  const guests: DeviceFacts[] = [];
  for (const d of data.devices) {
    if (!d.userId) guests.push(d);
    else byAccount.set(d.userId, [...(byAccount.get(d.userId) ?? []), d]);
  }
  const users: AnalyticsUser[] = [];
  for (const a of data.accounts) {
    const devices = byAccount.get(a.userId) ?? [];
    // A signed-in account with no installs (events lost, or only the web) still deserves a row; an empty guest account does not.
    if (!devices.length && a.anonymous) continue;
    const u = mergeDevices(a.userId, a.userId, devices);
    u.email = a.email;
    u.createdAt = a.createdAt;
    u.xp = a.xp;
    u.phraseChecks = a.phraseChecks;
    u.phrasesPassed = a.phrasesPassed;
    u.oldXp = a.oldXp;
    u.legacyTunes = a.legacyTunes;
    u.tunes = data.tunes
      .filter((t) => t.userId === a.userId)
      .map((t) => ({ tuneId: t.tuneId, checks: t.checks, passed: t.passed }))
      .sort((x, y) => y.checks - x.checks || x.tuneId.localeCompare(y.tuneId));
    byAccount.delete(a.userId);
    users.push(u);
  }
  // Devices linked to an account the loader did not return: treat them as guests rather than dropping them.
  for (const devices of byAccount.values()) guests.push(...devices);
  for (const d of guests) users.push(mergeDevices(`d:${d.deviceId}`, null, [d]));
  return users.sort((a, b) => (b.lastAt?.getTime() ?? 0) - (a.lastAt?.getTime() ?? 0));
}

// ── Steps ────────────────────────────────────────────────────────────────────────────────────

export interface FunnelStep {
  label: string;
  /** Optional side path (sign-in): shown indented and not counted as "stopped here". */
  branch: boolean;
  count: number;
}

interface StepDef {
  label: string;
  branch?: true;
  reached: (u: AnalyticsUser) => boolean;
}

const STEPS: StepDef[] = [
  { label: 'Открыли приложение', reached: () => true },
  { label: 'Онбординг: экран 1', reached: (u) => u.onboardingStep >= 1 || u.onboardingDone },
  { label: 'Онбординг: экран 2', reached: (u) => u.onboardingStep >= 2 },
  { label: 'Онбординг: экран 3', reached: (u) => u.onboardingStep >= 3 },
  { label: 'Закрыли онбординг', reached: (u) => u.onboardingDone },
  { label: 'Увидели вход', branch: true, reached: (u) => u.signinSeen },
  { label: 'Запросили код', branch: true, reached: (u) => u.codeRequested },
  { label: 'Вошли', branch: true, reached: (u) => u.signedIn },
  { label: 'Открыли практику', reached: (u) => u.practiceOpened },
  { label: 'Прослушали мелодию', reached: (u) => u.melodyPlayed },
  { label: 'Начали отвечать', reached: (u) => u.answerStarted || u.answers > 0 },
  { label: 'Проверили ответ', reached: (u) => u.answers >= 1 },
  { label: '3+ ответа', reached: (u) => u.answers >= 3 },
  { label: 'Прошли фразу', reached: (u) => u.phrasesPassed >= 1 },
  { label: 'Вернулись в другой день', reached: (u) => u.days >= 2 },
];

const MAIN = STEPS.filter((s) => !s.branch);

/** The funnel counts only people whose build reports screens; others would all read as "stopped at the first step". */
export function buildFunnel(users: AnalyticsUser[]): FunnelStep[] {
  const tracked = users.filter((u) => u.tracked);
  return STEPS.map((s) => ({ label: s.label, branch: !!s.branch, count: tracked.filter(s.reached).length }));
}

/** The last main step a person reached: where their run stopped. */
export function furthestStep(u: AnalyticsUser): string {
  let label = MAIN[0].label;
  for (const s of MAIN) if (s.reached(u)) label = s.label;
  return label;
}

export const furthestIndex = (u: AnalyticsUser): number => MAIN.findIndex((s) => s.label === furthestStep(u));

/** Every step with whether this person reached it, for the person's own card. */
export function stepChecklist(u: AnalyticsUser): { label: string; branch: boolean; reached: boolean }[] {
  return STEPS.map((s) => ({ label: s.label, branch: !!s.branch, reached: s.reached(u) }));
}

/** How far the optional sign-in went, in one word. */
export function signinLabel(u: AnalyticsUser): string {
  if (u.signedIn || u.email) return 'вошёл';
  if (u.codeRequested) return 'запросил код';
  if (u.signinSeen) return 'видел';
  return '—';
}

const SCREENS: Record<string, string> = {
  home: 'Главная',
  onboarding: 'Онбординг',
  sign_in: 'Вход',
  practice: 'Практика',
  settings: 'Настройки',
  progress: 'Прогресс',
};

const PHASES: Record<string, string> = {
  idle: 'до мелодии',
  playingMelody: 'играла мелодия',
  awaitingInput: 'отвечал',
  grading: 'проверка',
  feedback: 'смотрел результат',
};

export function placeLabel(screen: string | null, phase: string | null): string {
  if (!screen) return 'неизвестно';
  const name = SCREENS[screen] ?? screen;
  const p = phase ? (PHASES[phase] ?? phase) : '';
  return p ? `${name} · ${p}` : name;
}

/** Where people were when they last left the app, most common first. */
export function leaveSpots(users: AnalyticsUser[]): { place: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const u of users) {
    if (!u.tracked) continue;
    const place = placeLabel(u.leftScreen, u.leftPhase);
    counts.set(place, (counts.get(place) ?? 0) + 1);
  }
  return [...counts].map(([place, count]) => ({ place, count })).sort((a, b) => b.count - a.count || a.place.localeCompare(b.place));
}

// ── Status ───────────────────────────────────────────────────────────────────────────────────

export type Status = 'active' | 'cooled' | 'left' | 'none';

const DAY_MS = 24 * 60 * 60 * 1000;

/** active: seen within a day, or practising and seen within 3; cooled: practised, then 3+ days of silence; left: never got to practice; none: no events at all. */
export function statusOf(u: AnalyticsUser, now: Date): Status {
  if (!u.lastAt) return 'none';
  const age = now.getTime() - u.lastAt.getTime();
  if (age < DAY_MS) return 'active';
  const practised = u.practiceOpened || u.melodyPlayed || u.answers > 0 || u.attempts > 0;
  if (!practised) return 'left';
  return age >= 3 * DAY_MS ? 'cooled' : 'active';
}

export const STATUS_LABEL: Record<Status, string> = { active: 'активен', cooled: 'остыл', left: 'ушёл до практики', none: 'нет событий' };

/** XP to show and sort by: the server's, or, while it has none, the app's own count. */
export const shownXp = (u: { xp: number; oldXp: number }): number => u.xp || u.oldXp;

export const isGuest = (u: AnalyticsUser): boolean => !u.email;

export const ratePct = (n: number, of: number): string => (of ? `${Math.round((n / of) * 100)} %` : '—');

// ── Summary ──────────────────────────────────────────────────────────────────────────────────

export interface Summary {
  total: number;
  withEmail: number;
  activeWeek: number;
  reachedAnswer: number;
  returned: number;
}

export function summarize(users: AnalyticsUser[], now: Date): Summary {
  return {
    total: users.length,
    withEmail: users.filter((u) => u.email).length,
    activeWeek: users.filter((u) => u.lastAt && now.getTime() - u.lastAt.getTime() < 7 * DAY_MS).length,
    reachedAnswer: users.filter((u) => u.answers >= 1 || u.attempts >= 1).length,
    returned: users.filter((u) => u.days >= 2).length,
  };
}
