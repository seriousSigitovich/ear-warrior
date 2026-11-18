// Server-rendered owner page for the melody library (spec 024). Plain HTML; a few lines of script send the edit
// and upload requests with the browser's own Basic auth. Every value that reaches the page is escaped.
import { CSS, esc } from '../social/page.js';
import { adminNav } from '../admin/nav.js';
import { isVisible } from './validate.js';
import type { Tune } from './store.js';

const EXTRA_CSS = `
.dt td.l,.dt th.l{text-align:left;white-space:normal}
.badge{display:inline-block;padding:1px 8px;border-radius:999px;font-size:12px;border:1px solid var(--line)}
.badge.live{background:var(--tint);color:var(--accent)}.badge.hid{color:var(--muted)}.badge.warn{color:var(--bad);border-color:var(--bad)}
form.new{display:grid;gap:10px;max-width:760px;margin:12px 0 28px}
form.new label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--muted)}
input,textarea{font:inherit;font-size:14px;padding:6px 8px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--text);width:100%}
textarea{font-family:ui-monospace,Menlo,monospace;min-height:70px}
.row2{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.msg{min-height:1.4em;font-size:13px}.msg.bad{color:var(--bad)}
td button{margin:0 4px 4px 0}
.add{margin:16px 0}
.add>summary{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:10px;background:var(--accent);color:var(--on-accent);font-weight:600;font-size:15px;cursor:pointer;list-style:none;user-select:none}
.add>summary::-webkit-details-marker{display:none}
.add>summary:hover{filter:brightness(1.1)}
.add[open]>summary{filter:brightness(.9)}
.list{margin:12px 0;display:grid;gap:10px}
details.lvl{border:1px solid var(--line);border-radius:10px;overflow:hidden}
details.lvl>summary{display:flex;align-items:center;gap:12px;padding:10px 12px;cursor:pointer;list-style:none;font-weight:600}
details.lvl>summary::-webkit-details-marker{display:none}
details.lvl>summary::before{content:'▸';color:var(--muted);width:1em;flex:none}
details.lvl[open]>summary::before{content:'▾'}
details.lvl>summary:hover{background:var(--tint)}
details.lvl>summary .t-meta{margin-left:auto}
details.lvl>.tunes{border-top:1px solid var(--line)}
details.tune{border-top:1px solid var(--line)}details.tune:first-child{border-top:0}
details.tune>summary{display:flex;align-items:center;gap:12px;padding:8px 12px;cursor:pointer;list-style:none}
details.tune>summary::-webkit-details-marker{display:none}
details.tune>summary::before{content:'▸';color:var(--muted);width:1em;flex:none}
details.tune[open]>summary::before{content:'▾'}
details.tune[open]>summary{background:var(--tint)}
details.tune>summary:hover{background:var(--tint)}
.t-id{font-weight:600;flex:none;min-width:9ch}.t-title{flex:1;min-width:0;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.t-meta{flex:none;font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums}
.t-body{padding:6px 12px 14px 37px;display:grid;gap:8px;font-size:14px}
.t-body .acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.t-body input[type=file]{width:auto}
`;

const SCRIPT = `
const msg = document.getElementById('msg');
const say = (t, bad) => { msg.textContent = t; msg.className = 'msg' + (bad ? ' bad' : ''); };
async function call(method, url, body, headers) {
  const res = await fetch(url, { method, headers, body, credentials: 'same-origin' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { say((data.errors || [data.error || res.status]).join('; '), true); return null; }
  return data;
}
async function act(url, method) { if (await call(method || 'POST', url)) location.reload(); }
async function upload(id, input) {
  const file = input.files[0]; if (!file) return;
  say('Загружаю ' + file.name + '…');
  const show = document.getElementById('show-' + id).checked ? '?show=1' : '';
  if (await call('PUT', '/admin/tunes/' + id + '/audio' + show, file, { 'content-type': 'audio/mp4' })) location.reload();
}
const KEY = 'ew.tunes.open';
const keyOf = (d) => d.dataset.k;
let open = [];
try { open = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { open = []; }
document.querySelectorAll('details[data-k]').forEach((d) => {
  if (open.includes(keyOf(d))) d.open = true;
  d.addEventListener('toggle', () => {
    const now = [...document.querySelectorAll('details[data-k][open]')].map(keyOf);
    try { localStorage.setItem(KEY, JSON.stringify(now)); } catch (e) { /* private mode: state is simply not kept */ }
  });
});
document.getElementById('new').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const body = JSON.stringify({ title: f.get('title'), level: Number(f.get('level')), tempo_bpm: Number(f.get('tempo')),
    phrases: String(f.get('phrases')).split(/[ ,]+/).filter(Boolean).map(Number), notes: f.get('notes'), scale: f.get('scale'), source: f.get('source') });
  if (await call('POST', '/admin/tunes/' + encodeURIComponent(f.get('id')), body, { 'content-type': 'application/json' })) location.reload();
});
`;

const row = (t: Tune): string => `<details class="tune" data-k="t-${esc(t.id)}">
<summary><span class="t-id">${esc(t.id)}</span><span class="t-title">${esc(t.title)}</span><span class="t-meta">${t.tempoBpm} BPM</span>${t.audioUrl ? '' : '<span class="badge warn">нет звука</span>'}<span class="badge ${isVisible(t) ? 'live' : 'hid'}">${isVisible(t) ? 'виден' : 'скрыт'}</span></summary>
<div class="t-body">
<div><span class="muted">Фразы:</span> ${esc(t.phrases.join(' · '))}${t.scale ? ` <span class="muted">· ${esc(t.scale)}</span>` : ''}</div>
<div><span class="muted">Звук:</span> ${t.audioUrl ? `<a href="${esc(t.audioUrl)}">${Math.round((t.audioBytes ?? 0) / 1024)} КБ</a> <span class="muted small">${esc((t.audioSha256 ?? '').slice(0, 8))}</span>` : 'не загружен'}</div>
<div class="acts">
<button onclick="act('/admin/tunes/${esc(t.id)}/${t.hidden ? 'show' : 'hide'}')">${t.hidden ? 'Показать' : 'Скрыть'}</button>
<button onclick="if(confirm('Удалить ${esc(t.id)}? XP за его фразы останется.'))act('/admin/tunes/${esc(t.id)}','DELETE')">Удалить</button>
<input type="file" accept=".m4a,audio/mp4" onchange="upload('${esc(t.id)}',this)" aria-label="Звук для ${esc(t.id)}">
<label class="small muted"><input type="checkbox" id="show-${esc(t.id)}" style="width:auto"> показать после загрузки</label>
</div></div></details>`;

const plural = (n: number, one: string, few: string, many: string): string => {
  const m = n % 100;
  const d = n % 10;
  return `${n} ${m >= 11 && m <= 14 ? many : d === 1 ? one : d >= 2 && d <= 4 ? few : many}`;
};

const levelBlock = (level: number, group: Tune[]): string => {
  const live = group.filter(isVisible).length;
  const mute = group.filter((t) => !t.audioUrl).length;
  return `<details class="lvl" data-k="l-${level}"><summary>Уровень ${level}<span class="t-meta">${plural(group.length, 'мелодия', 'мелодии', 'мелодий')} · видно ${live}${mute ? ` · без звука ${mute}` : ''}</span></summary>
<div class="tunes">
${group.map(row).join('\n')}
</div></details>`;
};

export function renderTunesPage(tunes: Tune[]): string {
  const visible = tunes.filter(isVisible).length;
  const byLevel = new Map<number, Tune[]>();
  for (const t of tunes) byLevel.set(t.level, [...(byLevel.get(t.level) ?? []), t]);
  const levels = [...byLevel.entries()].sort((a, b) => a[0] - b[0]);
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Мелодии — Ear Warrior</title><style>${CSS}${EXTRA_CSS}</style></head><body><main>
<header><h1>Мелодии · Ear Warrior</h1>${adminNav('/admin/tunes')}</header>
<p class="muted small">${tunes.length} мелодий, ${visible} видно игрокам. Ответ (ноты) хранится только здесь и никогда не уходит в приложение. Мелодия видна, когда у неё есть звук и она не скрыта.</p>
<p id="msg" class="msg" role="status"></p>
<details class="add" data-k="add"><summary>＋ Новая мелодия</summary>
<p class="muted small">Тот же id, что у существующей мелодии, — это правка её полей.</p>
<form id="new" class="new">
<div class="row2"><label>id (латиница и цифры)<input name="id" required pattern="[a-z0-9]{1,60}"></label><label>Название<input name="title" required></label>
<label>Уровень 1–9<input name="level" type="number" min="1" max="9" required></label><label>Темп (BPM)<input name="tempo" type="number" step="any" required></label></div>
<label>Ноты: pitch:beats через пробел (E4:1 D4:2)<textarea name="notes" required></textarea></label>
<label>Фразы: число нот в каждой, через пробел (6 11)<input name="phrases" required></label>
<div class="row2"><label>Строй (C_major_pentatonic)<input name="scale"></label><label>Источник<input name="source"></label></div>
<div><button class="primary" type="submit">Сохранить</button></div>
</form></details>
<div class="list">
${levels.map(([level, group]) => levelBlock(level, group)).join('\n')}
</div>
<script>${SCRIPT}</script>
</main></body></html>`;
}
