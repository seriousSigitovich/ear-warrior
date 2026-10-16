// Server-rendered dashboard: one HTML string, no client JS, no dependencies. Layout is "essence
// first, details on demand": status strip + one card per platform + top posts at the top, and the
// full per-post breakdown behind <details>. Everything that came from a platform API (titles,
// captions, error text) is third-party data, so it is HTML-escaped before it reaches the page.
import { PLATFORMS, type Platform, type PostMetrics } from './types.js';
import type { Dashboard, PostView, SortKey } from './summary.js';
import { sortPosts } from './summary.js';

export interface RunInfo {
  platform: string;
  finishedAt: Date | null;
  ok: boolean | null;
  posts: number | null;
  error: string | null;
}

export interface PageModel {
  dashboard: Dashboard;
  runs: RunInfo[];
  configured: Record<Platform, boolean>;
  platformFilter: Platform | null;
  sort: SortKey;
  now: Date;
}

const esc = (s: unknown): string =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const nf = new Intl.NumberFormat('ru-RU');
const fmt = (n: number | null | undefined): string => (n === null || n === undefined ? '—' : nf.format(Math.round(n)));
const fmt1 = (n: number): string => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n);
const signed = (n: number): string => (n > 0 ? '+' : n < 0 ? '−' : '±') + nf.format(Math.abs(Math.round(n)));

export function ago(from: Date, now: Date): string {
  const min = Math.max(0, Math.round((now.getTime() - from.getTime()) / 60000));
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} ч назад`;
  return `${Math.round(h / 24)} дн назад`;
}

const NAMES: Record<Platform, string> = { youtube: 'YouTube', instagram: 'Instagram' };

const LABELS: { key: keyof PostMetrics; label: string; fmt: (n: number) => string }[] = [
  { key: 'views', label: 'Просмотры', fmt: (n) => fmt(n) },
  { key: 'reach', label: 'Охват', fmt: (n) => fmt(n) },
  { key: 'likes', label: 'Лайки', fmt: (n) => fmt(n) },
  { key: 'comments', label: 'Комментарии', fmt: (n) => fmt(n) },
  { key: 'shares', label: 'Репосты', fmt: (n) => fmt(n) },
  { key: 'saves', label: 'Сохранения', fmt: (n) => fmt(n) },
  { key: 'avgWatchS', label: 'Ср. время просмотра', fmt: (n) => `${fmt1(n)} с` },
  { key: 'avgWatchPct', label: 'Ср. % просмотра', fmt: (n) => `${fmt1(n)} %` },
  { key: 'follows', label: 'Подписки с поста', fmt: (n) => fmt(n) },
  { key: 'profileVisits', label: 'Визиты в профиль', fmt: (n) => fmt(n) },
];

const EXTRA_LABELS: Record<string, string> = {
  profile_views_28d: 'Визиты в профиль, 28 д',
  website_clicks_28d: 'Тапы по ссылке, 28 д',
  reach_28d: 'Охват аккаунта, 28 д',
};

function sparkline(series: { value: number }[], w = 96, h = 26): string {
  if (series.length < 2) return `<span class="muted small">нет истории</span>`;
  const vs = series.map((p) => p.value);
  const min = Math.min(...vs);
  const span = Math.max(...vs) - min || 1;
  const pts = vs.map((v, i) => `${((i / (vs.length - 1)) * (w - 2) + 1).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4) + 1).toFixed(1)}`);
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

function bigChart(series: { day: string; value: number }[]): string {
  if (series.length < 2) {
    return `<p class="muted small">История по дням появится после нескольких сборов (сейчас точек: ${series.length}).</p>`;
  }
  const w = 560;
  const h = 120;
  const vs = series.map((p) => p.value);
  const min = Math.min(...vs);
  const span = Math.max(...vs) - min || 1;
  const x = (i: number) => 8 + (i / (series.length - 1)) * (w - 16);
  const y = (v: number) => 10 + (1 - (v - min) / span) * (h - 30);
  const pts = series.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Просмотры по дням">
    <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>
    <text x="8" y="${h - 4}" class="axis">${esc(series[0]!.day)} · ${fmt(vs[0])}</text>
    <text x="${w - 8}" y="${h - 4}" class="axis" text-anchor="end">${esc(series[series.length - 1]!.day)} · ${fmt(vs[vs.length - 1])}</text>
  </svg>`;
}

function statusStrip(m: PageModel): string {
  const chips = PLATFORMS.map((p) => {
    const run = m.runs.find((r) => r.platform === p);
    let cls = 'warn';
    let text: string;
    if (!m.configured[p]) text = 'не подключён';
    else if (!run) text = 'ещё не собирали';
    else if (run.ok) {
      cls = 'ok';
      text = `обновлено ${run.finishedAt ? ago(run.finishedAt, m.now) : '—'}`;
    } else {
      cls = 'bad';
      text = 'ошибка последнего сбора';
    }
    const detail = m.configured[p] && run && run.ok === false && run.error ? `<div class="err">${esc(run.error)}</div>` : '';
    return `<div class="chip ${cls}"><span class="dot"></span><b>${NAMES[p]}</b> ${esc(text)}${detail}</div>`;
  });
  return `<div class="status">${chips.join('')}</div>`;
}

function platformCard(m: PageModel, p: Dashboard['platforms'][number]): string {
  const d = m.dashboard;
  let big: string;
  let sub: string;
  if (p.gain !== null) {
    big = signed(p.gain);
    let vs = '';
    if (p.prevGain !== null && p.prevGain > 0) {
      const pct = Math.round(((p.gain - p.prevGain) / p.prevGain) * 100);
      vs = ` · ${pct >= 0 ? '+' : '−'}${Math.abs(pct)} % к прошлым ${d.days} дн`;
    }
    sub = `просмотров за ${d.days} дн${vs}`;
  } else {
    big = fmt(p.totalViews);
    sub = `просмотров всего · прирост за ${d.days} дн появится, когда накопится история${d.historyFrom ? ` (собираем с ${esc(d.historyFrom)})` : ''}`;
  }
  const rows: string[] = [];
  rows.push(
    `<div><span class="muted">Подписчики</span><b>${fmt(p.followers)}${p.followersDelta !== null ? ` <i class="delta">${signed(p.followersDelta)}</i>` : ''}</b></div>`,
  );
  rows.push(`<div><span class="muted">Публикаций</span><b>${fmt(p.postCount)}</b></div>`);
  if (p.gain !== null) rows.push(`<div><span class="muted">Просмотров всего</span><b>${fmt(p.totalViews)}</b></div>`);
  for (const [k, v] of Object.entries(p.extra)) {
    rows.push(`<div><span class="muted">${esc(EXTRA_LABELS[k] ?? k)}</span><b>${fmt(v)}</b></div>`);
  }
  const best = p.best
    ? `<div class="best muted small">Лучший: <a href="${esc(p.best.post.url)}" rel="noopener noreferrer" target="_blank">${esc(postTitle(p.best))}</a> ${signed(p.best.gain ?? 0)}</div>`
    : '';
  return `<article class="card"><h2>${NAMES[p.platform]}</h2><div class="big">${esc(big)}</div><div class="muted small">${sub}</div><div class="kv">${rows.join('')}</div>${best}</article>`;
}

function postTitle(v: PostView): string {
  const t = v.post.title.trim() || '(без названия)';
  // The number is parsed out of the title, so only prefix it when the title does not already show it.
  return v.post.videoNo !== null && !t.includes(`#${v.post.videoNo}`) ? `#${v.post.videoNo} · ${t}` : t;
}

function postItem(v: PostView, days: number): string {
  const l = v.latest;
  const metricRows = l
    ? LABELS.filter((x) => l[x.key] !== null)
        .map((x) => `<div><span class="muted">${x.label}</span><b>${x.fmt(l[x.key] as number)}</b></div>`)
        .join('')
    : '';
  const published = v.post.publishedAt.toISOString().slice(0, 10);
  return `<details class="post">
  <summary>
    <span class="badge ${esc(v.post.platform)}">${esc(NAMES[v.post.platform as Platform] ?? v.post.platform)}</span>
    <span class="t">${esc(postTitle(v))}</span>
    <span class="num"><b>${fmt(l?.views)}</b><small>просм.</small></span>
    <span class="num gain">${v.gain === null ? '<b class="muted">—</b>' : `<b>${signed(v.gain)}</b>`}<small>за ${days} дн</small></span>
    <span class="num hide-s"><b>${fmt(l?.likes)}</b><small>лайки</small></span>
    <span class="num hide-s"><b>${fmt(l?.comments)}</b><small>комм.</small></span>
    <span class="spark-wrap hide-s">${sparkline(v.series)}</span>
  </summary>
  <div class="detail">
    <div class="meta muted small">${esc(v.post.kind)} · ${esc(published)}${v.post.durationS !== null ? ` · ${v.post.durationS} с` : ''} · <a href="${esc(v.post.url)}" rel="noopener noreferrer" target="_blank">открыть</a></div>
    <div class="kv">${metricRows}</div>
    ${bigChart(v.series)}
  </div>
</details>`;
}

const CSS = `
:root{--bg:#161826;--surface:#232532;--text:#e9e9ed;--muted:rgba(233,233,237,.6);--line:rgba(233,233,237,.16);--accent:#9184d9;--accent2:#a7a1db;--ok:#7fc6a4;--warn:#c2a190;--bad:#e08a8a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.45 -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif}
a{color:var(--accent2)}main{max-width:1040px;margin:0 auto;padding:24px 16px 64px}
.muted{color:var(--muted)}.small{font-size:12.5px}
header{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center;justify-content:space-between;margin-bottom:16px}
h1{font-size:22px;margin:0}h2{font-size:15px;margin:0 0 6px;color:var(--accent2);font-weight:600}
h3{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:32px 0 10px;font-weight:600}
.controls{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.seg a,.seg span{padding:5px 11px;border:1px solid var(--line);color:var(--text);text-decoration:none;font-size:13px}
.seg{display:inline-flex}.seg>*{border-radius:0;margin-left:-1px}.seg>*:first-child{border-radius:8px 0 0 8px;margin-left:0}.seg>*:last-child{border-radius:0 8px 8px 0}
.seg .on{background:var(--accent);border-color:var(--accent);color:#161826;font-weight:600}
button{font:inherit;font-size:13px;padding:5px 12px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--text);cursor:pointer}
.status{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}
.chip{background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:4px 12px;font-size:13px}
.chip .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px;background:var(--warn)}
.chip.ok .dot{background:var(--ok)}.chip.bad .dot{background:var(--bad)}
.chip .err{margin-top:2px;color:var(--bad);font-size:12px;max-width:560px;word-break:break-word}
.chip:has(.err){border-radius:12px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
.big{font-size:34px;font-weight:700;letter-spacing:-.02em;line-height:1.15}
.kv{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px 14px;margin-top:12px}
.kv div{display:flex;flex-direction:column}.kv .muted{font-size:12px}.kv b{font-weight:600}
.delta{font-style:normal;color:var(--ok);font-weight:500;font-size:13px}.best{margin-top:12px}
.post{background:var(--surface);border:1px solid var(--line);border-radius:12px;margin-bottom:8px}
.post summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:auto 1fr auto auto auto auto 100px;gap:10px 14px;align-items:center;padding:10px 14px}
.post summary::-webkit-details-marker{display:none}
.post[open] summary{border-bottom:1px solid var(--line)}
.t{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.num{display:flex;flex-direction:column;align-items:flex-end;min-width:54px}.num small{color:var(--muted);font-size:11px}
.badge{display:inline-block;min-width:76px;text-align:center;font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--line);color:var(--accent2)}
.badge.instagram{color:var(--warn)}
.spark{color:var(--accent)}.detail{padding:12px 14px 14px}.meta{margin-bottom:6px}
.chart{width:100%;max-width:560px;height:auto;margin-top:12px}.axis{fill:var(--muted);font-size:10px}
.sort{margin:0 0 10px;font-size:13px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.top{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.top li{display:grid;grid-template-columns:auto 1fr auto 100px;gap:12px;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:9px 14px}
.empty{padding:20px;border:1px dashed var(--line);border-radius:12px;color:var(--muted)}
@media(max-width:720px){.post summary{grid-template-columns:auto 1fr auto auto}.hide-s{display:none}.big{font-size:28px}}
`;

function periodLinks(m: PageModel): string {
  const q = (days: number) => `?days=${days}${m.platformFilter ? `&platform=${m.platformFilter}` : ''}&sort=${m.sort}`;
  return `<span class="seg">${[7, 28, 90].map((d) => (d === m.dashboard.days ? `<span class="on">${d} дн</span>` : `<a href="${q(d)}">${d} дн</a>`)).join('')}</span>`;
}

function platformLinks(m: PageModel): string {
  const q = (p: Platform | null) => `?days=${m.dashboard.days}${p ? `&platform=${p}` : ''}&sort=${m.sort}`;
  const items: [string, Platform | null][] = [['Все', null], ['YouTube', 'youtube'], ['Instagram', 'instagram']];
  return `<span class="seg">${items.map(([label, p]) => (p === m.platformFilter ? `<span class="on">${label}</span>` : `<a href="${q(p)}">${label}</a>`)).join('')}</span>`;
}

function sortLinks(m: PageModel): string {
  const q = (s: SortKey) => `?days=${m.dashboard.days}${m.platformFilter ? `&platform=${m.platformFilter}` : ''}&sort=${s}`;
  const items: [string, SortKey][] = [['по приросту', 'gain'], ['по просмотрам', 'views'], ['по дате', 'date']];
  return `<span class="seg">${items.map(([label, s]) => (s === m.sort ? `<span class="on">${label}</span>` : `<a href="${q(s)}">${label}</a>`)).join('')}</span>`;
}

export function renderPage(m: PageModel): string {
  const d = m.dashboard;
  const visible = d.posts.filter((v) => !m.platformFilter || v.post.platform === m.platformFilter);
  const ranked = sortPosts(visible, m.sort);
  const top = sortPosts(visible, 'gain').filter((v) => (v.gain ?? 0) > 0).slice(0, 5);
  const cards = d.platforms.filter((p) => !m.platformFilter || p.platform === m.platformFilter);

  const body = `
<header>
  <h1>Соцсети · Ear Warrior</h1>
  <div class="controls">${periodLinks(m)}${platformLinks(m)}
    <form method="post" action="/admin/social/collect" style="margin:0"><button type="submit">Обновить сейчас</button></form>
  </div>
</header>
${statusStrip(m)}
${cards.length ? `<div class="cards">${cards.map((p) => platformCard(m, p)).join('')}</div>` : `<div class="empty">Данных пока нет. Подключи платформы (см. README → Social analytics) и нажми «Обновить сейчас».</div>`}
${top.length ? `<h3>Что сработало за ${d.days} дн</h3><ol class="top">${top.map((v) => `<li><span class="badge ${esc(v.post.platform)}">${esc(NAMES[v.post.platform as Platform] ?? v.post.platform)}</span><span class="t">${esc(postTitle(v))}</span><b>${signed(v.gain ?? 0)}</b><span>${sparkline(v.series)}</span></li>`).join('')}</ol>` : ''}
<h3>Все публикации · ${visible.length}</h3>
<div class="sort muted">Сортировка ${sortLinks(m)}</div>
${ranked.length ? ranked.map((v) => postItem(v, d.days)).join('') : `<div class="empty">Публикаций пока нет.</div>`}
<p class="muted small" style="margin-top:28px">Просмотры по дням считаются как разница суточных снимков (UTC), поэтому прирост виден только там, где есть снимок на начало периода. «Продолжили смотреть» (viewed vs swiped) из Studio через API недоступно — оно остаётся в docs/experiments.md.</p>`;

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Соцсети — Ear Warrior</title><style>${CSS}</style></head><body><main>${body}</main></body></html>`;
}
