// Server-rendered analytics page for the owner: totals, the first-run funnel, and one row per person that opens
// into their own card. Pure (people in, HTML out), so it is tested without a database. Emails are typed by
// strangers, so every value is escaped before it reaches the page.
import { CSS, ago, esc, sortTh } from '../social/page.js';
import { adminNav } from '../admin/nav.js';
import {
  STATUS_LABEL,
  buildFunnel,
  furthestIndex,
  furthestStep,
  isGuest,
  leaveSpots,
  placeLabel,
  shownXp,
  ratePct,
  signinLabel,
  statusOf,
  stepChecklist,
  summarize,
  type AnalyticsUser,
  type ServerTotals,
  type Status,
} from './model.js';

export type SortKey = 'last' | 'first' | 'days' | 'step' | 'attempts' | 'correct' | 'xp';
export const SORTS: SortKey[] = ['last', 'first', 'days', 'step', 'attempts', 'correct', 'xp'];
export type WhoFilter = 'all' | 'signed' | 'guests' | Status;
export const FILTERS: WhoFilter[] = ['all', 'signed', 'guests', 'active', 'cooled', 'left'];
export type Period = 'all' | '7d';

/** What the owner asked for in the query string. Everything is checked against a list, so nothing typed reaches the page unescaped. */
export interface View {
  sort: SortKey;
  who: WhoFilter;
  /** Cohort: people whose first event was within the last 7 days. */
  period: Period;
  /** Cohort: the app version last seen; '' for all. */
  version: string;
  /** Substring of the email or device id. */
  q: string;
}

export const DEFAULT_VIEW: View = { sort: 'last', who: 'all', period: 'all', version: '', q: '' };

export function parseView(query: Record<string, unknown>): View {
  const s = (k: string): string => (typeof query[k] === 'string' ? (query[k] as string) : '');
  return {
    sort: SORTS.includes(s('sort') as SortKey) ? (s('sort') as SortKey) : DEFAULT_VIEW.sort,
    who: FILTERS.includes(s('who') as WhoFilter) ? (s('who') as WhoFilter) : DEFAULT_VIEW.who,
    period: s('period') === '7d' ? '7d' : 'all',
    version: s('version').slice(0, 40),
    q: s('q').trim().slice(0, 80),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const time = (d: Date | null): number => (d ? d.getTime() : -Infinity);
const rate = (u: AnalyticsUser): number => (u.attempts ? u.attemptsCorrect / u.attempts : -1);

const BY: Record<SortKey, (a: AnalyticsUser, b: AnalyticsUser) => number> = {
  last: (a, b) => time(b.lastAt) - time(a.lastAt),
  first: (a, b) => time(b.firstAt ?? b.createdAt) - time(a.firstAt ?? a.createdAt),
  days: (a, b) => b.days - a.days,
  step: (a, b) => furthestIndex(b) - furthestIndex(a),
  attempts: (a, b) => b.attempts - a.attempts,
  correct: (a, b) => rate(b) - rate(a),
  xp: (a, b) => shownXp(b) - shownXp(a),
};

/** The cohort the totals and the funnel are about. */
export function inCohort(u: AnalyticsUser, now: Date, view: View): boolean {
  if (view.period === '7d') {
    const since = u.firstAt ?? u.createdAt;
    if (!since || now.getTime() - since.getTime() > 7 * DAY_MS) return false;
  }
  if (view.version && u.appVersion !== view.version) return false;
  return true;
}

function matchesWho(u: AnalyticsUser, now: Date, who: WhoFilter): boolean {
  if (who === 'all') return true;
  if (who === 'signed') return !isGuest(u);
  if (who === 'guests') return isGuest(u);
  return statusOf(u, now) === who;
}

function matchesQuery(u: AnalyticsUser, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (u.email ?? '').toLowerCase().includes(needle) || u.deviceIds.some((d) => d.toLowerCase().startsWith(needle));
}

const dash = '—';
const dm = (d: Date | null): string => (d ? `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}` : dash);
const num = (n: number): string => (n ? String(n) : dash);
const minutes = (s: number): string => (s >= 60 ? `${Math.round(s / 60)} мин` : `${s} с`);
const who = (u: AnalyticsUser): string => (u.email ? esc(u.email) : `Гость ${esc((u.deviceIds[0] ?? '').slice(0, 8))}`);

const STATUS_CLASS: Record<Status, string> = { active: 'ok', cooled: 'warn', left: 'bad', none: 'none' };

const EXTRA_CSS = `
.bar{display:inline-block;height:8px;border-radius:4px;background:var(--accent);vertical-align:middle;margin-right:8px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:8px}
.kpi{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 14px}
.kpi b{display:block;font-size:26px;font-weight:600;letter-spacing:-.02em;line-height:1.2}
.pill{display:inline-block;font-size:11.5px;padding:2px 9px;border-radius:999px;font-weight:600;background:var(--tint);color:var(--accent)}
.pill.warn{background:var(--warm-bg);color:var(--warm-text)}.pill.bad{background:transparent;border:1px solid var(--bad);color:var(--bad)}.pill.none{background:transparent;border:1px solid var(--line);color:var(--muted)}
.filters{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;margin:0 0 10px}
.filters form{display:inline-flex;gap:6px}
input[type=search]{font:inherit;font-size:13px;padding:5px 10px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--text);width:220px}
tr.u{cursor:pointer}tr.u td:first-child::before{content:"▸ ";color:var(--muted)}tr.u.open td:first-child::before{content:"▾ "}
.dt .more td{white-space:normal;text-align:left;background:var(--bg);padding:14px 16px}
.dt .more:hover td{background:var(--bg)}
.det{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px 28px;font-size:13px;line-height:1.75}
.det h4{margin:0 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600}
.det .no{color:var(--muted)}.det .err{color:var(--bad)}
`;

const SCRIPT = `<script>document.querySelectorAll('tr.u').forEach(function(r){r.addEventListener('click',function(e){if(e.target.closest('a'))return;var m=r.nextElementSibling;m.hidden=!m.hidden;r.classList.toggle('open',!m.hidden)})})</script>`;

function details(u: AnalyticsUser, now: Date, cols: number): string {
  const steps = stepChecklist(u)
    .filter((s) => !s.branch || s.reached)
    .map((s) => `<div class="${s.reached ? '' : 'no'}">${s.reached ? '✓' : '○'} ${esc(s.label)}</div>`)
    .join('');
  const dated = [
    u.onboardedAt && `${dm(u.onboardedAt)} · онбординг закрыт`,
    u.signedInAt && `${dm(u.signedInAt)} · вошёл`,
    u.firstMelodyAt && `${dm(u.firstMelodyAt)} · первая мелодия`,
    u.firstAnswerAt && `${dm(u.firstAnswerAt)} · первый ответ`,
  ].filter((x): x is string => !!x);
  const tunes = u.tunes.length
    ? u.tunes.slice(0, 3).map((t) => `${esc(t.tuneId)} (${t.checks})`).join(', ')
    : u.legacyTunes.slice(0, 3).map((t) => `${esc(t.tuneId)} (${t.phrase} из ${t.phrases} фр.)`).join(', ');
  const avgSession = u.sessions && u.sessionSeconds ? minutes(Math.round(u.sessionSeconds / u.sessions)) : dash;
  const keyboard = u.attempts ? ratePct(u.fretboardAttempts, u.attempts) : dash;
  const ids = u.deviceIds.map((d) => esc(d.slice(0, 8))).join(', ');
  return `<tr class="more" hidden><td colspan="${cols}"><div class="det">
<div><h4>Путь</h4>${steps}${dated.length ? `<div style="margin-top:6px">${dated.map(esc).join('<br>')}</div>` : ''}<div style="margin-top:6px">Ушёл: ${esc(placeLabel(u.leftScreen, u.leftPhase))}</div></div>
<div><h4>Практика</h4>
Попыток: ${u.attempts || u.answers || 0} · верно ${esc(ratePct(u.attempts ? u.attemptsCorrect : u.correct, u.attempts || u.answers))}<br>
Сессий: ${u.sessions || dash} · средняя ${esc(avgSession)}<br>
Уровень: ${u.maxRank ?? dash} · черновик: ${num(u.drafts)}<br>
Ввод грифом: ${esc(keyboard)}<br>
Октавные ошибки: ${num(u.octaveMismatches)}</div>
<div><h4>Прогресс</h4>
XP: ${u.xp ? u.xp : u.oldXp ? `${u.oldXp}<span class="muted"> (старые правила, считало приложение)</span>` : dash}<br>
Фраз пройдено: ${num(u.phrasesPassed)} · проверок ${num(u.phraseChecks)}<br>
Мелодии: ${tunes ? tunes : dash}<br>
Серия: ${u.streak ? `${u.streak} дн` : dash} · рангов: ${num(u.rankUps)}<br>
Ежедневных заданий: ${num(u.challengesDone)}</div>
<div><h4>Устройство</h4>
Версия: ${esc(u.appVersion ?? dash)}<br>
Устройств: ${u.deviceIds.length} (${ids})<br>
Первый запуск: ${esc(dm(u.firstAt))} · дней: ${num(u.days)}<br>
Ошибки входа: ${u.signinErrors.length ? `<span class="err">${esc(u.signinErrors.join(', '))}</span>` : 'нет'}${u.tracked ? '' : '<br><span class="no">сборка без screen_view: путь неполный</span>'}</div>
</div></td></tr>`;
}

export function renderAnalyticsPage(all: AnalyticsUser[], now: Date, view: View = DEFAULT_VIEW, totals?: ServerTotals): string {
  const cohort = all.filter((u) => inCohort(u, now, view));
  const sum = summarize(cohort, now);
  const steps = buildFunnel(cohort);
  const trackedTotal = cohort.filter((u) => u.tracked).length;
  let prevMain = trackedTotal;
  const stepRows = steps
    .map((s) => {
      const drop = s.branch ? '' : prevMain > s.count ? `−${prevMain - s.count}` : dash;
      if (!s.branch) prevMain = s.count;
      const width = trackedTotal ? Math.round((s.count / trackedTotal) * 160) : 0;
      return `<tr${s.branch ? ' class="sub"' : ''}><td class="pt">${esc(s.label)}</td><td class="l"><span class="bar" style="width:${width}px"></span>${s.count}</td><td>${ratePct(s.count, trackedTotal)}</td><td>${s.branch ? '' : esc(drop)}</td></tr>`;
    })
    .join('');
  const spotRows = leaveSpots(cohort)
    .map((s) => `<tr><td class="pt">${esc(s.place)}</td><td>${s.count}</td><td>${ratePct(s.count, trackedTotal)}</td></tr>`)
    .join('');

  const shown = cohort.filter((u) => matchesWho(u, now, view.who) && matchesQuery(u, view.q));
  const sorted = view.sort === 'last' ? shown : [...shown].sort(BY[view.sort]);
  const COLS = 10;
  const rows = sorted
    .map((u) => {
      const st = statusOf(u, now);
      const attempts = u.attempts || u.answers;
      const correct = u.attempts ? u.attemptsCorrect : u.correct;
      return `<tr class="u"><td class="pt">${who(u)}<div class="muted small">${esc(u.appVersion ? `v${u.appVersion}` : dash)}${u.deviceIds.length > 1 ? ` · ${u.deviceIds.length} устр.` : ''}</div></td>
<td class="l"><span class="pill ${STATUS_CLASS[st]}">${esc(STATUS_LABEL[st])}</span></td><td class="d">${esc(dm(u.firstAt ?? u.createdAt))}</td><td>${esc(u.lastAt ? ago(u.lastAt, now) : dash)}</td><td>${num(u.days)}</td><td class="l">${esc(u.tracked ? furthestStep(u) : dash)}</td><td class="l">${esc(signinLabel(u))}</td><td>${num(attempts)}</td><td>${esc(ratePct(correct, attempts))}</td><td>${u.xp ? u.xp : u.oldXp ? `${u.oldXp}*` : dash}</td></tr>
${details(u, now, COLS)}`;
    })
    .join('');

  // Every link keeps the rest of the view; only the named parts change.
  const href = (patch: Partial<View>): string => {
    const v = { ...view, ...patch };
    const p = new URLSearchParams();
    if (v.sort !== DEFAULT_VIEW.sort) p.set('sort', v.sort);
    if (v.who !== 'all') p.set('who', v.who);
    if (v.period !== 'all') p.set('period', v.period);
    if (v.version) p.set('version', v.version);
    if (v.q) p.set('q', v.q);
    const s = p.toString();
    return s ? `?${s}` : '?';
  };
  const seg = (items: [label: string, active: boolean, link: string][]): string =>
    `<span class="seg">${items.map(([label, on, link]) => (on ? `<span class="on">${esc(label)}</span>` : `<a href="${esc(link)}">${esc(label)}</a>`)).join('')}</span>`;
  const versions = [...new Set(all.map((u) => u.appVersion).filter((v): v is string => !!v))].sort().reverse().slice(0, 5);
  const WHO_LABELS: [WhoFilter, string][] = [['all', 'Все'], ['signed', 'Вошли'], ['guests', 'Гости'], ['active', 'Активные'], ['cooled', 'Остыли'], ['left', 'Ушли до практики']];
  const th = (label: string, key: SortKey, cls = ''): string => sortTh(label, key === view.sort, href({ sort: key }), cls);

  const body = `
<header>
  <h1>Аналитика · Ear Warrior</h1>
  ${adminNav('/admin/analytics')}
</header>
<div class="filters">
  ${seg([['Всё время', view.period === 'all', href({ period: 'all' })], ['Новые за 7 дн', view.period === '7d', href({ period: '7d' })]])}
  ${versions.length ? seg([['Все версии', !view.version, href({ version: '' })], ...versions.map((v): [string, boolean, string] => [`v${v}`, view.version === v, href({ version: v })])]) : ''}
</div>
<div class="kpis">
  <div class="kpi"><span class="muted small">Пользователей</span><b>${sum.total}</b><span class="muted small">${sum.withEmail} с почтой</span></div>
  <div class="kpi"><span class="muted small">Активны за 7 дн</span><b>${sum.activeWeek}</b><span class="muted small">${ratePct(sum.activeWeek, sum.total)}</span></div>
  <div class="kpi"><span class="muted small">Дошли до ответа</span><b>${sum.reachedAnswer}</b><span class="muted small">${ratePct(sum.reachedAnswer, sum.total)}</span></div>
  <div class="kpi"><span class="muted small">Вернулись на другой день</span><b>${sum.returned}</b><span class="muted small">${ratePct(sum.returned, sum.total)}</span></div>
</div>
${sum.total ? '' : '<div class="empty">Пока нет данных.</div>'}
<h3>Воронка первого запуска · ${trackedTotal} чел.</h3>
<div class="wrap"><table class="dt">
<thead><tr><th class="pt">Шаг</th><th class="l">Людей</th><th>От открывших</th><th>Отвалилось</th></tr></thead>
<tbody>${stepRows}</tbody>
</table></div>
<h3>Где были, когда ушли из приложения</h3>
<div class="wrap"><table class="dt">
<thead><tr><th class="pt">Экран · момент</th><th>Людей</th><th>Доля</th></tr></thead>
<tbody>${spotRows}</tbody>
</table></div>
<h3>Пользователи · ${sorted.length}${sorted.length === cohort.length ? '' : ` из ${cohort.length}`}</h3>
<div class="filters">
  ${seg(WHO_LABELS.map(([k, label]): [string, boolean, string] => [label, view.who === k, href({ who: k })]))}
  <form method="get">${view.sort !== 'last' ? `<input type="hidden" name="sort" value="${esc(view.sort)}">` : ''}${view.who !== 'all' ? `<input type="hidden" name="who" value="${esc(view.who)}">` : ''}${view.period !== 'all' ? `<input type="hidden" name="period" value="${esc(view.period)}">` : ''}${view.version ? `<input type="hidden" name="version" value="${esc(view.version)}">` : ''}<input type="search" name="q" value="${esc(view.q)}" placeholder="почта или id устройства"><button>Найти</button></form>
</div>
<div class="wrap"><table class="dt">
<thead><tr><th class="pt">Кто</th><th class="l">Статус</th>${th('Первый запуск', 'first', 'd')}${th('Был', 'last')}${th('Дней', 'days')}${th('Дошёл до', 'step', 'l')}<th class="l">Вход</th>${th('Попыток', 'attempts')}${th('Верно', 'correct')}${th('XP', 'xp')}</tr></thead>
<tbody>${rows}</tbody>
</table></div>
<p class="muted small" style="margin-top:20px">Человек — это аккаунт со всеми его устройствами или, без входа, одно устройство. Воронка и «где ушли» считают только тех, чья сборка шлёт <code>screen_view</code>. Вход необязателен, поэтому он показан отдельной веткой и в «Отвалилось» не считается. Статус: активен — был за сутки или практиковался и был за 3 дня; остыл — 3+ дня тишины после практики; ушёл — не дошёл до практики. Попытки — из <code>attempt_log</code>. XP: серверный, а пока его нет — со звёздочкой (*) то, что насчитало приложение по старым правилам; он не сравним с серверным.</p>
${totals ? `<p class="muted small">На сервере: строк XP — ${totals.xpRows}, проверок фраз — ${totals.phraseChecks}, аккаунтов — ${totals.accounts} (гостевых ${totals.guestAccounts}, сессий гостей ${totals.guestSessions}).</p>` : ''}
${SCRIPT}`;
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Аналитика — Ear Warrior</title><style>${CSS}${EXTRA_CSS}</style></head><body><main>${body}</main></body></html>`;
}
