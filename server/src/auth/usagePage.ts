// Server-rendered "who is who" page for the owner: one row per account, a total for attempts that
// belong to nobody, and one row per such device under it. Emails are typed by strangers, so every value is escaped before it reaches the page.
import { CSS, ago, esc, sortTh } from '../social/page.js';

export interface UsageRow {
  devices: number;
  attempts: number;
  attempts7d: number;
  correct: number;
  lastAt: Date | null;
}

export interface AccountUsage extends UsageRow {
  email: string;
  createdAt: Date;
}

/** One device's anonymous attempts; `devices` is always 1, kept so the row renders like the others. */
export interface DeviceUsage extends UsageRow {
  deviceId: string;
  firstAt: Date;
}

export interface UsageReport {
  accounts: AccountUsage[];
  /** Attempts with no account in force at their time (never signed in, or after sign-out). */
  anonymous: UsageRow;
  /** The same attempts split by device, most recent first. */
  anonymousDevices: DeviceUsage[];
}

/** Columns the owner can sort accounts by; 'last' is the loader's own order. */
export type UsersSort = 'last' | 'since' | 'attempts' | 'week' | 'correct';
export const USERS_SORTS: UsersSort[] = ['last', 'since', 'attempts', 'week', 'correct'];

const rate = (r: UsageRow): number => (r.attempts ? r.correct / r.attempts : -1);
const time = (d: Date | null): number => (d ? d.getTime() : -Infinity);
const BY: Record<UsersSort, (a: AccountUsage, b: AccountUsage) => number> = {
  last: (a, b) => time(b.lastAt) - time(a.lastAt),
  since: (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  attempts: (a, b) => b.attempts - a.attempts,
  week: (a, b) => b.attempts7d - a.attempts7d,
  correct: (a, b) => rate(b) - rate(a),
};

const dash = '—';
const num = (n: number): string => String(n);
const share = (r: UsageRow): string => (r.attempts ? `${Math.round((r.correct / r.attempts) * 100)} %` : dash);
const when = (d: Date | null, now: Date): string => (d ? ago(d, now) : dash);
const day = (d: Date): string => d.toISOString().slice(0, 10);
// Random per-install ids: a short prefix is enough to tell devices apart on one page.
const shortId = (id: string): string => id.slice(0, 8);

function cells(r: UsageRow, now: Date): string {
  return `<td>${r.devices ? num(r.devices) : dash}</td><td>${r.attempts ? num(r.attempts) : dash}</td><td>${r.attempts7d ? num(r.attempts7d) : dash}</td><td>${share(r)}</td><td>${esc(when(r.lastAt, now))}</td>`;
}

export function renderUsersPage(report: UsageReport, now: Date, sort: UsersSort = 'last'): string {
  const accounts = sort === 'last' ? report.accounts : [...report.accounts].sort(BY[sort]);
  const accountRows = accounts
    .map((a) => `<tr><td class="pt">${esc(a.email)}</td><td class="d">${esc(day(a.createdAt))}</td>${cells(a, now)}</tr>`)
    .join('');
  const deviceRows = report.anonymousDevices
    .map((d) => `<tr class="sub"><td class="pt">Устройство ${esc(shortId(d.deviceId))}</td><td class="d">${esc(day(d.firstAt))}</td>${cells(d, now)}</tr>`)
    .join('');
  const th = (label: string, key: UsersSort, cls = '') => sortTh(label, key === sort, `?sort=${key}`, cls);
  const body = `
<header>
  <h1>Тестеры · Ear Warrior</h1>
  <div class="controls"><a href="/admin/funnel">Воронка</a><a href="/admin/social">Соцсети</a></div>
</header>
${report.accounts.length ? '' : '<div class="empty">Аккаунтов пока нет.</div>'}
<h3>Аккаунты · ${report.accounts.length}</h3>
<div class="wrap"><table class="dt">
<thead><tr><th class="pt">Аккаунт</th>${th('С', 'since', 'd')}<th>Устройств</th>${th('Попыток', 'attempts')}${th('За 7 дн', 'week')}${th('Верно', 'correct')}${th('Последняя', 'last')}</tr></thead>
<tbody>${accountRows}</tbody>
</table></div>
<h3>Без входа · не входили или вышли из аккаунта</h3>
<div class="wrap"><table class="dt">
<thead><tr><th class="pt">Устройство</th><th class="d">С</th><th>Устройств</th><th>Попыток</th><th>За 7 дн</th><th>Верно</th><th>Последняя</th></tr></thead>
<tbody><tr><td class="pt"><b>Всего</b></td><td class="d">${dash}</td>${cells(report.anonymous, now)}</tr>${deviceRows}</tbody>
</table></div>
<p class="muted small" style="margin-top:20px">Принадлежность попытки считается при чтении по привязкам устройства (data-model.md, «Attribution rule»): попытки до первого входа — первому аккаунту на устройстве, после выхода — анонимные.</p>`;
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Тестеры — Ear Warrior</title><style>${CSS}</style></head><body><main>${body}</main></body></html>`;
}
