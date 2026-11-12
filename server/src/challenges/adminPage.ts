// Server-rendered owner pages for the daily challenges (spec 020): the next days with their source, and one
// day's form. Plain HTML, no client JS. Every value that reaches the page is escaped.
import { CSS, esc } from '../social/page.js';
import type { DailyChallenges } from './daily.js';

export interface DayRow {
  date: string;
  source: 'manual' | 'auto';
  day: DailyChallenges;
  editable: boolean;
}

/** The form's fields as typed: strings, so a rejected form is shown again exactly as it was entered. */
export interface FormValues {
  slots: { type: string; target: string; xp: string; title: string; desc: string }[];
  bonus: string;
}

export function formFromDay(day: DailyChallenges): FormValues {
  return {
    slots: day.challenges.map((c) => ({ type: c.type, target: String(c.target), xp: String(c.rewardXp), title: c.title, desc: c.description })),
    bonus: String(day.allBonusXp),
  };
}

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const weekday = (date: string): string => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];

const EXTRA_CSS = `
.dt td.l,.dt th.l{text-align:left;white-space:normal}.dt td.l div{white-space:nowrap}
.badge.manual{background:var(--warm-bg);color:var(--warm-text)}
form.day{display:grid;gap:14px;max-width:860px}
.slot{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px 16px;display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr))}
.slot h2{grid-column:1/-1;margin:0}.slot label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--muted)}
.slot .wide{grid-column:1/-1}
input,select{font:inherit;font-size:14px;padding:6px 8px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--text);width:100%}
.errors{border:1px solid var(--bad);border-radius:12px;padding:10px 16px;color:var(--bad)}.errors ul{margin:4px 0 0;padding-left:18px}
.notice{border:1px solid var(--line);border-radius:12px;padding:10px 16px;background:var(--warm-bg);color:var(--warm-text);font-size:13px}
.actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}button.primary{background:var(--accent);color:var(--on-accent);border-color:var(--accent);font-weight:600}
`;

const shell = (title: string, body: string): string =>
  `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(title)} — Ear Warrior</title><style>${CSS}${EXTRA_CSS}</style></head><body><main>${body}</main></body></html>`;

export function renderChallengesList(rows: DayRow[], today: string, saved?: string): string {
  const body = `
<header>
  <h1>Челленджи дня · Ear Warrior</h1>
  <div class="controls"><a href="/admin/users">Тестеры</a><a href="/admin/funnel">Воронка</a><a href="/admin/social">Соцсети</a></div>
</header>
${saved ? `<p class="notice">${esc(saved)}</p>` : ''}
<p class="muted small">Дни без ручной правки считает генератор. Править можно с завтрашнего дня (UTC): устройство запоминает челленджи дня после первого запроса, поэтому сегодняшние уже не изменить. Для тех, кто восточнее UTC, «завтра» может уже наступить.</p>
<div class="wrap"><table class="dt"><thead><tr><th class="l">День</th><th>Источник</th><th class="l">Челленджи</th><th>Бонус</th><th></th></tr></thead><tbody>
${rows
  .map(
    (r) => `<tr><td class="l"><b>${esc(r.date)}</b> <span class="muted">${weekday(r.date)}${r.date === today ? ' · сегодня' : ''}</span></td>
<td><span class="badge ${r.source}">${r.source === 'manual' ? 'вручную' : 'авто'}</span></td>
<td class="l">${r.day.challenges.map((c) => `<div>${esc(c.title)} <span class="muted small">· ${c.rewardXp} XP</span></div>`).join('')}</td>
<td>${r.day.allBonusXp} XP</td>
<td>${r.editable ? `<a href="/admin/challenges/${esc(r.date)}">Править</a>` : '<span class="muted small">только чтение</span>'}</td></tr>`,
  )
  .join('\n')}
</tbody></table></div>`;
  return shell('Челленджи дня', body);
}

export function renderChallengeForm(date: string, source: 'manual' | 'auto', values: FormValues, errors: string[] = []): string {
  const slot = (i: number): string => {
    const s = values.slots[i] ?? { type: 'melodies', target: '', xp: '', title: '', desc: '' };
    const n = i + 1;
    const opt = (v: string): string => `<option value="${v}"${s.type === v ? ' selected' : ''}>${v === 'melodies' ? 'melodies — сыграть N мелодий' : 'accuracy — N% в одной мелодии'}</option>`;
    return `<section class="slot"><h2>Челлендж ${n}</h2>
<label class="wide">Тип<select name="type${n}">${opt('melodies')}${opt('accuracy')}</select></label>
<label>Цель<input name="target${n}" inputmode="numeric" value="${esc(s.target)}" required></label>
<label>XP<input name="xp${n}" inputmode="numeric" value="${esc(s.xp)}" required></label>
<label class="wide">Заголовок (до 80)<input name="title${n}" maxlength="80" value="${esc(s.title)}" required></label>
<label class="wide">Описание (до 120)<input name="desc${n}" maxlength="120" value="${esc(s.desc)}" required></label></section>`;
  };
  const body = `
<header><h1>${esc(date)} <span class="muted">${weekday(date)}</span> <span class="badge ${source}">${source === 'manual' ? 'вручную' : 'авто'}</span></h1>
<div class="controls"><a href="/admin/challenges">← Все дни</a></div></header>
${errors.length ? `<div class="errors"><b>Не сохранено</b><ul>${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
${source === 'auto' ? '<p class="notice">Этот день ещё считает генератор: в форме его значения. После сохранения день станет ручным.</p>' : ''}
<form class="day" method="post" action="/admin/challenges/${esc(date)}">
${[0, 1, 2].map(slot).join('\n')}
<section class="slot"><label>Бонус за все три (XP)<input name="bonus" inputmode="numeric" value="${esc(values.bonus)}" required></label></section>
<div class="actions"><button class="primary" type="submit">Сохранить</button></div>
</form>
${source === 'manual' ? `<form method="post" action="/admin/challenges/${esc(date)}/reset" style="margin-top:18px"><button type="submit">Вернуть генератор</button></form>` : ''}`;
  return shell(`Челленджи ${date}`, body);
}
