// Server-rendered owner page for the melody library (spec 024). Plain HTML; a few lines of script send the edit
// and upload requests with the browser's own Basic auth. Every value that reaches the page is escaped.
import { CSS, esc } from '../social/page.js';
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
document.getElementById('new').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const body = JSON.stringify({ title: f.get('title'), level: Number(f.get('level')), tempo_bpm: Number(f.get('tempo')),
    phrases: String(f.get('phrases')).split(/[ ,]+/).filter(Boolean).map(Number), notes: f.get('notes'), scale: f.get('scale'), source: f.get('source') });
  if (await call('POST', '/admin/tunes/' + encodeURIComponent(f.get('id')), body, { 'content-type': 'application/json' })) location.reload();
});
`;

const row = (t: Tune): string => `<tr>
<td class="l"><b>${esc(t.id)}</b><br><span class="muted small">${esc(t.title)}</span></td>
<td>${t.level}</td><td>${t.tempoBpm}</td>
<td class="l small">${esc(t.phrases.join(' · '))}<br><span class="muted">${esc(t.scale)}</span></td>
<td>${t.audioUrl ? `<a href="${esc(t.audioUrl)}">${Math.round((t.audioBytes ?? 0) / 1024)} КБ</a><br><span class="muted small">${esc((t.audioSha256 ?? '').slice(0, 8))}</span>` : '<span class="badge warn">нет звука</span>'}</td>
<td><span class="badge ${isVisible(t) ? 'live' : 'hid'}">${isVisible(t) ? 'виден' : 'скрыт'}</span></td>
<td class="l">
<button onclick="act('/admin/tunes/${esc(t.id)}/${t.hidden ? 'show' : 'hide'}')">${t.hidden ? 'Показать' : 'Скрыть'}</button>
<button onclick="if(confirm('Удалить ${esc(t.id)}? XP за его фразы останется.'))act('/admin/tunes/${esc(t.id)}','DELETE')">Удалить</button><br>
<input type="file" accept=".m4a,audio/mp4" onchange="upload('${esc(t.id)}',this)" aria-label="Звук для ${esc(t.id)}">
<label class="small muted"><input type="checkbox" id="show-${esc(t.id)}" style="width:auto"> показать после загрузки</label>
</td></tr>`;

export function renderTunesPage(tunes: Tune[]): string {
  const visible = tunes.filter(isVisible).length;
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Мелодии — Ear Warrior</title><style>${CSS}${EXTRA_CSS}</style></head><body><main>
<header><h1>Мелодии · Ear Warrior</h1><div class="controls"><a href="/admin/challenges">Челленджи</a><a href="/admin/users">Тестеры</a></div></header>
<p class="muted small">${tunes.length} мелодий, ${visible} видно игрокам. Ответ (ноты) хранится только здесь и никогда не уходит в приложение. Мелодия видна, когда у неё есть звук и она не скрыта.</p>
<p id="msg" class="msg" role="status"></p>
<details><summary>Новая мелодия или правка по id</summary>
<form id="new" class="new">
<div class="row2"><label>id (латиница и цифры)<input name="id" required pattern="[a-z0-9]{1,60}"></label><label>Название<input name="title" required></label>
<label>Уровень 1–9<input name="level" type="number" min="1" max="9" required></label><label>Темп (BPM)<input name="tempo" type="number" step="any" required></label></div>
<label>Ноты: pitch:beats через пробел (E4:1 D4:2)<textarea name="notes" required></textarea></label>
<label>Фразы: число нот в каждой, через пробел (6 11)<input name="phrases" required></label>
<div class="row2"><label>Строй (C_major_pentatonic)<input name="scale"></label><label>Источник<input name="source"></label></div>
<div><button class="primary" type="submit">Сохранить</button></div>
</form></details>
<div class="wrap"><table class="dt"><thead><tr><th class="l">Мелодия</th><th>Ур.</th><th>BPM</th><th class="l">Фразы</th><th>Звук</th><th>Статус</th><th class="l">Действия</th></tr></thead><tbody>
${tunes.map(row).join('\n')}
</tbody></table></div>
<script>${SCRIPT}</script>
</main></body></html>`;
}
