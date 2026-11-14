// Server-rendered first-run funnel for the owner: how far each device got (onboarding → optional
// sign-in → first melody → first answers → a second day) and where it was when it left the app.
// Built from app_events only; pure, so the steps and the page are tested without a database.
import { CSS, ago, esc, sortTh } from '../social/page.js';

/** One device's first run, folded out of its app_events (see report.ts). */
export interface DeviceRun {
  deviceId: string;
  /** The account the device was last linked to; null for a guest. Typed by strangers — escape it. */
  email: string | null;
  firstAt: Date;
  lastAt: Date;
  /** Distinct UTC days with any event. */
  days: number;
  /** Highest onboarding screen seen, 0 when none. */
  onboardingStep: number;
  onboardingDone: boolean;
  onboardingSkipped: boolean;
  signinSeen: boolean;
  codeRequested: boolean;
  signedIn: boolean;
  signinErrors: string[];
  practiceOpened: boolean;
  melodyPlayed: boolean;
  answerStarted: boolean;
  answers: number;
  correct: number;
  /** Screen and practice phase of the last `app_background`; null when the device never left (or the event was lost). */
  leftScreen: string | null;
  leftPhase: string | null;
}

export interface FunnelStep {
  label: string;
  /** Optional side path (sign-in): shown indented and not counted as "stopped here". */
  branch: boolean;
  count: number;
}

interface StepDef {
  label: string;
  branch?: true;
  reached: (d: DeviceRun) => boolean;
}

const STEPS: StepDef[] = [
  { label: 'Открыли приложение', reached: () => true },
  { label: 'Онбординг: экран 1', reached: (d) => d.onboardingStep >= 1 || d.onboardingDone },
  { label: 'Онбординг: экран 2', reached: (d) => d.onboardingStep >= 2 },
  { label: 'Онбординг: экран 3', reached: (d) => d.onboardingStep >= 3 },
  { label: 'Закрыли онбординг', reached: (d) => d.onboardingDone },
  { label: 'Увидели вход', branch: true, reached: (d) => d.signinSeen },
  { label: 'Запросили код', branch: true, reached: (d) => d.codeRequested },
  { label: 'Вошли', branch: true, reached: (d) => d.signedIn },
  { label: 'Открыли практику', reached: (d) => d.practiceOpened },
  { label: 'Прослушали мелодию', reached: (d) => d.melodyPlayed },
  { label: 'Начали отвечать', reached: (d) => d.answerStarted || d.answers > 0 },
  { label: 'Проверили ответ', reached: (d) => d.answers >= 1 },
  { label: '3+ ответа', reached: (d) => d.answers >= 3 },
  { label: 'Вернулись в другой день', reached: (d) => d.days >= 2 },
];

const MAIN = STEPS.filter((s) => !s.branch);

export function buildFunnel(devices: DeviceRun[]): FunnelStep[] {
  return STEPS.map((s) => ({ label: s.label, branch: !!s.branch, count: devices.filter(s.reached).length }));
}

/** The last main step a device reached: where its run stopped. */
export function furthestStep(d: DeviceRun): string {
  let label = MAIN[0].label;
  for (const s of MAIN) if (s.reached(d)) label = s.label;
  return label;
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

/** Where devices were when they last left the app, most common first. */
export function leaveSpots(devices: DeviceRun[]): { place: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of devices) {
    const place = placeLabel(d.leftScreen, d.leftPhase);
    counts.set(place, (counts.get(place) ?? 0) + 1);
  }
  return [...counts].map(([place, count]) => ({ place, count })).sort((a, b) => b.count - a.count || a.place.localeCompare(b.place));
}

const EXTRA_CSS = `
.bar{display:inline-block;height:8px;border-radius:4px;background:var(--accent);vertical-align:middle;margin-right:8px}
`;

/** Columns the device table can be sorted by; 'first' (newest first run on top) is the loader's order. */
export type FunnelSort = 'first' | 'last' | 'days' | 'step' | 'answers';
export const FUNNEL_SORTS: FunnelSort[] = ['first', 'last', 'days', 'step', 'answers'];

const stepIndex = (d: DeviceRun): number => MAIN.findIndex((s) => s.label === furthestStep(d));
const BY: Record<FunnelSort, (a: DeviceRun, b: DeviceRun) => number> = {
  first: (a, b) => b.firstAt.getTime() - a.firstAt.getTime(),
  last: (a, b) => b.lastAt.getTime() - a.lastAt.getTime(),
  days: (a, b) => b.days - a.days,
  step: (a, b) => stepIndex(b) - stepIndex(a),
  answers: (a, b) => b.answers - a.answers,
};

/** How far the optional sign-in went, in one word. */
export function signinLabel(d: DeviceRun): string {
  if (d.signedIn) return 'вошёл';
  if (d.codeRequested) return 'запросил код';
  if (d.signinSeen) return 'видел';
  return '—';
}

const pct = (n: number, of: number): string => (of ? `${Math.round((n / of) * 100)} %` : '—');
const day = (d: Date): string => d.toISOString().slice(0, 10);

export function renderFunnelPage(devices: DeviceRun[], now: Date, sort: FunnelSort = 'first'): string {
  const steps = buildFunnel(devices);
  const total = devices.length;
  let prevMain = total;
  const stepRows = steps
    .map((s) => {
      const drop = s.branch ? '' : prevMain ? `−${prevMain - s.count}` : '—';
      if (!s.branch) prevMain = s.count;
      const width = total ? Math.round((s.count / total) * 160) : 0;
      return `<tr${s.branch ? ' class="sub"' : ''}><td class="pt">${esc(s.label)}</td><td class="l"><span class="bar" style="width:${width}px"></span>${s.count}</td><td>${pct(s.count, total)}</td><td>${s.branch ? '' : esc(drop)}</td></tr>`;
    })
    .join('');
  const spotRows = leaveSpots(devices)
    .map((s) => `<tr><td class="pt">${esc(s.place)}</td><td>${s.count}</td><td>${pct(s.count, total)}</td></tr>`)
    .join('');
  const sorted = sort === 'first' ? devices : [...devices].sort(BY[sort]);
  const deviceRows = sorted
    .map((d) => {
      const who = d.email ? esc(d.email) : `Устройство ${esc(d.deviceId.slice(0, 8))}`;
      return `<tr><td class="pt">${who}</td><td class="d">${esc(day(d.firstAt))}</td><td>${esc(ago(d.lastAt, now))}</td><td>${d.days}</td><td class="l">${esc(furthestStep(d))}</td><td class="l">${esc(signinLabel(d))}</td><td>${d.answers || '—'}</td><td>${pct(d.correct, d.answers)}</td><td class="l">${esc(placeLabel(d.leftScreen, d.leftPhase))}</td><td class="l err">${d.signinErrors.length ? esc(d.signinErrors.join(', ')) : ''}</td></tr>`;
    })
    .join('');
  const th = (label: string, key: FunnelSort, cls = '') => sortTh(label, key === sort, `?sort=${key}`, cls);
  const body = `
<header>
  <h1>Воронка первого запуска · Ear Warrior</h1>
  <div class="controls"><a href="/admin/users">Тестеры</a><a href="/admin/social">Соцсети</a><a href="/admin/challenges">Челленджи</a></div>
</header>
${total ? '' : '<div class="empty">Пока нет устройств с новой аналитикой.</div>'}
<h3>Докуда доходят · ${total} устр.</h3>
<div class="wrap"><table class="dt">
<thead><tr><th class="pt">Шаг</th><th class="l">Устройств</th><th>От открывших</th><th>Отвалилось</th></tr></thead>
<tbody>${stepRows}</tbody>
</table></div>
<h3>Где были, когда ушли из приложения</h3>
<div class="wrap"><table class="dt">
<thead><tr><th class="pt">Экран · момент</th><th>Устройств</th><th>Доля</th></tr></thead>
<tbody>${spotRows}</tbody>
</table></div>
<h3>По устройствам · ${total}</h3>
<div class="wrap"><table class="dt">
<thead><tr><th class="pt">Кто</th>${th('Первый запуск', 'first', 'd')}${th('Последнее событие', 'last')}${th('Дней', 'days')}${th('Дошёл до', 'step', 'l')}<th class="l">Вход</th>${th('Ответов', 'answers')}<th>Верно</th><th class="l">Последний уход</th><th class="l">Ошибки входа</th></tr></thead>
<tbody>${deviceRows}</tbody>
</table></div>
<p class="muted small" style="margin-top:20px">Только устройства со сборкой, которая шлёт <code>screen_view</code>. Вход необязателен, поэтому он показан отдельной веткой и в «Отвалилось» не считается. «Последний уход» — экран последнего <code>app_background</code>.</p>`;
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Воронка — Ear Warrior</title><style>${CSS}${EXTRA_CSS}</style></head><body><main>${body}</main></body></html>`;
}
