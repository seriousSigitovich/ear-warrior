// Server-rendered "who is who" page for the owner: one row per account, a total for attempts that
// belong to nobody, and one row per such device under it. Emails are typed by strangers, so every value is escaped before it reaches the page.
import { CSS, ago, esc } from '../social/page.js';

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

const EXTRA_CSS = `
table.users{width:100%;border-collapse:collapse;background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.users th,.users td{padding:9px 12px;text-align:right;border-bottom:1px solid var(--line);font-size:14px}
.users th{font-size:12px;color:var(--muted);font-weight:600}
.users th:first-child,.users td:first-child{text-align:left;word-break:break-all}
.users tr:last-child td{border-bottom:0}.users tr.anon td{color:var(--muted)}
.users tr.dev td:first-child{padding-left:28px}
.wrap{overflow-x:auto}
`;

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

export function renderUsersPage(report: UsageReport, now: Date): string {
  const accountRows = report.accounts
    .map((a) => `<tr><td>${esc(a.email)}<div class="muted small">с ${esc(day(a.createdAt))}</div></td>${cells(a, now)}</tr>`)
    .join('');
  const deviceRows = report.anonymousDevices
    .map((d) => `<tr class="anon dev"><td>Устройство ${esc(shortId(d.deviceId))}<div class="small">с ${esc(day(d.firstAt))}</div></td>${cells(d, now)}</tr>`)
    .join('');
  const body = `
<header>
  <h1>Тестеры · Ear Warrior</h1>
  <div class="controls"><a href="/admin/funnel">Воронка</a><a href="/admin/social">Соцсети</a></div>
</header>
${report.accounts.length ? '' : '<div class="empty">Аккаунтов пока нет.</div>'}
<div class="wrap"><table class="users">
<thead><tr><th>Аккаунт</th><th>Устройств</th><th>Попыток</th><th>За 7 дн</th><th>Верно</th><th>Последняя</th></tr></thead>
<tbody>${accountRows}<tr class="anon"><td>Без входа<div class="small">не входили или вышли из аккаунта</div></td>${cells(report.anonymous, now)}</tr>${deviceRows}</tbody>
</table></div>
<p class="muted small" style="margin-top:20px">Принадлежность попытки считается при чтении по привязкам устройства (data-model.md, «Attribution rule»): попытки до первого входа — первому аккаунту на устройстве, после выхода — анонимные.</p>`;
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Тестеры — Ear Warrior</title><style>${CSS}${EXTRA_CSS}</style></head><body><main>${body}</main></body></html>`;
}
