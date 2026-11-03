#!/usr/bin/env node
// Ranks public-domain tunes for the challenge videos by how well people already know them, BEFORE a video is built: the same video with
// another tune gets views an order of magnitude apart (the user, 2026-11-02), and the tune is the one choice we can score in advance.
//
//   node scripts/tune-rank.mjs                  Wikipedia pageviews only (free) + the ranking from whatever is cached
//   node scripts/tune-rank.mjs --youtube[=N]    also search YouTube Shorts for up to N tunes not cached yet (101 quota units each, 10 000/day
//                                               shared with the collector AND the publish uploads, so run it after an upload day's last post)
//
// Signals, each a proxy for "a viewer recognises it in the first notes":
//   wiki    English Wikipedia views of the piece's article, last 12 months: general fame, not guitar-specific.
//   shorts  YouTube Shorts for "<tune> guitar" whose title names the tune (25 results, relevance): median and top views. Says whether
//           guitar Shorts with this tune already find an audience. Noisy: lifetime views, big channels win; hits are matched by keywords.
// Score = mean percentile of log(wiki), log(shorts median) and log(shorts top) across the list; a missing signal is left out of the mean.
// `ours` = our own Instagram views for that tune (format in brackets); the floor for any reel is ~1.5–2 K, so only breakouts mean much.
// Cache: docs/tune-signals.json (re-runs spend no quota). Output: docs/tune-ranking.md.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(root, 'docs', 'tune-signals.json');
const OUT = join(root, 'docs', 'tune-ranking.md');
const UA = 'ear-warrior-tune-rank/1.0 (dsigitovich@gmail.com)';

// title · Wikipedia article (redirects are followed) · YouTube query (" guitar" is added) · keywords, one of which a Short's title must hold ·
// ours · pd: false = not public domain, kept only to compare with what we posted
const TUNES = [
  { id: 'mountain-king', title: 'In the Hall of the Mountain King', wiki: 'In the Hall of the Mountain King', q: 'hall of the mountain king', match: ['mountain king'], ours: '874, 1 424 (cards) · 9 694 (#60 neon)' },
  { id: 'korobeiniki', title: 'Korobeiniki (Tetris)', wiki: 'Korobeiniki', q: 'korobeiniki tetris theme', match: ['korobeiniki', 'tetris'], ours: '#65 queued' },
  { id: 'fifth', title: 'Beethoven’s Fifth', wiki: 'Symphony No. 5 (Beethoven)', q: 'beethoven 5th symphony', match: ['5th symphony', 'fifth symphony', 'symphony no. 5', 'symphony no 5', 'beethoven 5'], ours: '2 006 at 4 h (#66 neon)' },
  { id: 'entertainer', title: 'The Entertainer', wiki: 'The Entertainer (rag)', q: 'the entertainer scott joplin', match: ['entertainer'] },
  { id: 'bumblebee', title: 'Flight of the Bumblebee', wiki: 'Flight of the Bumblebee', q: 'flight of the bumblebee', match: ['bumblebee', 'bumble bee'], ours: '#69 queued' },
  { id: 'toccata', title: 'Toccata and Fugue in D minor', wiki: 'Toccata and Fugue in D minor, BWV 565', q: 'toccata and fugue in d minor', match: ['toccata'], ours: '2 994 (#62 minimal)' },
  { id: 'fur-elise', title: 'Für Elise', wiki: 'Für Elise', q: 'fur elise', match: ['elise'], ours: '1 549 (one string)' },
  { id: 'ode-to-joy', title: 'Ode to Joy', wiki: 'Ode to Joy', q: 'ode to joy', match: ['ode to joy'] },
  { id: 'turkish-march', title: 'Rondo alla Turca', wiki: 'Piano Sonata No. 11 (Mozart)', q: 'rondo alla turca turkish march', match: ['turca', 'turkish march'], ours: '2 039 (Remotion tour)' },
  { id: 'nachtmusik', title: 'Eine kleine Nachtmusik', wiki: 'Eine kleine Nachtmusik', q: 'eine kleine nachtmusik', match: ['nachtmusik'], ours: '1 583 (#59 3D)' },
  { id: 'swan-lake', title: 'Swan Lake theme', wiki: 'Swan Lake', q: 'swan lake theme', match: ['swan lake'] },
  // the three seasons redirect to one article, so Wikipedia cannot tell them apart
  { id: 'vivaldi-spring', title: 'Vivaldi, Spring', wiki: 'Spring (Vivaldi)', q: 'vivaldi spring', match: ['spring'], ours: '2 171 (Remotion tour)' },
  { id: 'vivaldi-summer', title: 'Vivaldi, Summer (Presto)', wiki: 'Summer (Vivaldi)', q: 'vivaldi summer presto', match: ['summer'], ours: '1 961 (Remotion tour)' },
  { id: 'vivaldi-winter', title: 'Vivaldi, Winter', wiki: 'Winter (Vivaldi)', q: 'vivaldi winter', match: ['winter'], ours: '1 613 (#57 minimal)' },
  { id: 'paganini-24', title: 'Paganini, Caprice No. 24', wiki: 'Caprice No. 24 (Paganini)', q: 'paganini caprice 24', match: ['caprice', 'paganini'], ours: '1 545 (#42 neck)' },
  { id: 'greensleeves', title: 'Greensleeves', wiki: 'Greensleeves', q: 'greensleeves', match: ['greensleeves'] },
  { id: 'canon-d', title: 'Canon in D', wiki: 'Pachelbel\'s Canon', q: 'canon in d', match: ['canon'] },
  { id: 'moonlight', title: 'Moonlight Sonata', wiki: 'Piano Sonata No. 14 (Beethoven)', q: 'moonlight sonata', match: ['moonlight'] },
  { id: 'william-tell', title: 'William Tell Overture', wiki: 'William Tell Overture', q: 'william tell overture', match: ['william tell'] },
  { id: 'habanera', title: 'Habanera (Carmen)', wiki: 'Habanera (aria)', q: 'habanera carmen', match: ['habanera', 'carmen'] },
  { id: 'toreador', title: 'Toreador Song', wiki: 'Toreador Song', q: 'toreador song', match: ['toreador'] },
  { id: 'can-can', title: 'Can-can (Infernal Galop)', wiki: 'Can-can', q: 'can can offenbach', match: ['can can', 'can-can', 'cancan', 'galop'] },
  { id: 'valkyries', title: 'Ride of the Valkyries', wiki: 'Ride of the Valkyries', q: 'ride of the valkyries', match: ['valkyrie'] },
  { id: 'morning-mood', title: 'Morning Mood', wiki: 'Morning Mood', q: 'morning mood grieg', match: ['morning mood', 'peer gynt'] },
  { id: 'sugar-plum', title: 'Dance of the Sugar Plum Fairy', wiki: 'Dance of the Sugar Plum Fairy', q: 'dance of the sugar plum fairy', match: ['sugar plum'] },
  { id: 'blue-danube', title: 'The Blue Danube', wiki: 'The Blue Danube', q: 'blue danube waltz', match: ['danube'] },
  { id: 'radetzky', title: 'Radetzky March', wiki: 'Radetzky March', q: 'radetzky march', match: ['radetzky'] },
  { id: 'cello-suite', title: 'Bach, Cello Suite No. 1 Prelude', wiki: 'Cello Suites (Bach)', q: 'bach cello suite 1 prelude', match: ['cello suite', 'prelude'] },
  { id: 'air-g', title: 'Air on the G String', wiki: 'Air on the G String', q: 'air on the g string', match: ['air on', 'g string'] },
  { id: 'minuet-g', title: 'Minuet in G', wiki: 'Minuet in G major, BWV Anh. 114', q: 'minuet in g bach', match: ['minuet'], ours: '1 501 (#51 neck)' },
  { id: 'o-fortuna', title: 'O Fortuna', wiki: 'O Fortuna', q: 'o fortuna', match: ['fortuna'], pd: false },
  { id: 'hungarian-5', title: 'Hungarian Dance No. 5', wiki: 'Hungarian Dances (Brahms)', q: 'hungarian dance no 5', match: ['hungarian dance'] },
  { id: 'funeral-march', title: 'Chopin, Funeral March', wiki: 'Piano Sonata No. 2 (Chopin)', q: 'chopin funeral march', match: ['funeral march'] },
  { id: 'wedding-march', title: 'Wedding March (Mendelssohn)', wiki: 'Wedding March (Mendelssohn)', q: 'wedding march mendelssohn', match: ['wedding march'] },
  { id: 'gymnopedie', title: 'Gymnopédie No. 1', wiki: 'Gymnopédies', q: 'gymnopedie no 1', match: ['gymnop'] },
  { id: 'clair-de-lune', title: 'Clair de lune', wiki: 'Clair de lune (Debussy)', q: 'clair de lune', match: ['clair de lune'] },
  { id: 'danse-macabre', title: 'Danse macabre', wiki: 'Danse macabre (Saint-Saëns)', q: 'danse macabre', match: ['danse macabre'] },
  { id: 'zarathustra', title: 'Also sprach Zarathustra', wiki: 'Also sprach Zarathustra (Strauss)', q: 'also sprach zarathustra', match: ['zarathustra', '2001'] },
  { id: 'carol-bells', title: 'Carol of the Bells', wiki: 'Carol of the Bells', q: 'carol of the bells', match: ['carol of the bells'] },
  { id: 'rising-sun', title: 'House of the Rising Sun', wiki: 'The House of the Rising Sun', q: 'house of the rising sun', match: ['rising sun'] },
  { id: 'scarborough', title: 'Scarborough Fair', wiki: 'Scarborough Fair (ballad)', q: 'scarborough fair', match: ['scarborough'] },
  { id: 'spanish-romance', title: 'Spanish Romance', wiki: 'Spanish Romance', q: 'spanish romance', match: ['romance', 'romanza'] },
  { id: 'asturias', title: 'Asturias (Leyenda)', wiki: 'Asturias (Leyenda)', q: 'asturias leyenda', match: ['asturias', 'leyenda'] },
  { id: 'alhambra', title: 'Recuerdos de la Alhambra', wiki: 'Recuerdos de la Alhambra', q: 'recuerdos de la alhambra', match: ['alhambra'] },
  { id: 'bella-ciao', title: 'Bella ciao', wiki: 'Bella ciao', q: 'bella ciao', match: ['bella ciao'] },
  { id: 'dark-eyes', title: 'Dark Eyes', wiki: 'Dark Eyes (Russian song)', q: 'dark eyes ochi chernye', match: ['dark eyes', 'ochi'] },
  { id: 'ievan-polkka', title: 'Ievan Polkka', wiki: 'Ievan Polkka', q: 'ievan polkka', match: ['ievan', 'polkka'] },
  { id: 'hava-nagila', title: 'Hava Nagila', wiki: 'Hava Nagila', q: 'hava nagila', match: ['hava nagila'] },
  { id: 'kalinka', title: 'Kalinka', wiki: 'Kalinka (1860 song)', q: 'kalinka', match: ['kalinka'] },
  { id: 'drunken-sailor', title: 'Drunken Sailor', wiki: 'Drunken Sailor', q: 'drunken sailor', match: ['drunken sailor'] },
  { id: 'amazing-grace', title: 'Amazing Grace', wiki: 'Amazing Grace', q: 'amazing grace', match: ['amazing grace'] },
  { id: 'saints', title: 'When the Saints Go Marching In', wiki: 'When the Saints Go Marching In', q: 'when the saints go marching in', match: ['saints'] },
  { id: 'happy-birthday', title: 'Happy Birthday', wiki: 'Happy Birthday to You', q: 'happy birthday', match: ['happy birthday'] },
  { id: 'jingle-bells', title: 'Jingle Bells', wiki: 'Jingle Bells', q: 'jingle bells', match: ['jingle bells'] },
  { id: 'silent-night', title: 'Silent Night', wiki: 'Silent Night', q: 'silent night', match: ['silent night'] },
  { id: 'twinkle', title: 'Twinkle, Twinkle', wiki: 'Twinkle, Twinkle, Little Star', q: 'twinkle twinkle little star', match: ['twinkle'] },
  { id: 'mozart-40', title: 'Mozart, Symphony No. 40', wiki: 'Symphony No. 40 (Mozart)', q: 'mozart symphony 40', match: ['symphony 40', 'symphony no. 40', 'symphony no 40', '40th'] },
  { id: 'la-cucaracha', title: 'La Cucaracha', wiki: 'La Cucaracha', q: 'la cucaracha', match: ['cucaracha'] },
  { id: 'auld-lang-syne', title: 'Auld Lang Syne', wiki: 'Auld Lang Syne', q: 'auld lang syne', match: ['auld lang syne'] },
  { id: 'nu-pogodi', title: 'Nu, pogodi! theme', wiki: 'Nu, pogodi!', q: 'nu pogodi', match: ['pogodi', 'погоди'], pd: false, ours: '3 055 (#56 neon) · 2 088 (#61 re-cut)' },
];

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
const save = () => writeFileSync(CACHE, JSON.stringify(cache, null, 1) + '\n');
const get = async (url, headers = {}) => { const r = await fetch(url, { headers: { 'User-Agent': UA, ...headers } }); return [r.status, await r.json()]; };

// --- Wikipedia: follow redirects, then 12 full months of user pageviews (all access) -------------------------------------------------------
const now = new Date(), end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)), start = new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth() + 1, 1));
const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
for (const t of TUNES) {
  const c = (cache[t.id] ??= {});
  if (c.wikiTo === ymd(end)) continue;
  const [, q] = await get(`https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&titles=${encodeURIComponent(t.wiki)}`);
  const page = Object.values(q.query.pages)[0];
  if (page.missing !== undefined) { console.warn(`wiki: no article "${t.wiki}" (${t.id})`); c.wiki = null; continue; }
  const [st, pv] = await get(`https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(page.title.replace(/ /g, '_'))}/monthly/${ymd(start)}00/${ymd(end)}00`);
  c.wikiTitle = page.title;
  c.wiki = st === 200 ? pv.items.reduce((s, i) => s + i.views, 0) : null;
  c.wikiTo = ymd(end);
}
save();

// --- YouTube: Shorts for "<tune> guitar", the hits whose title names the tune ----------------------------------------------------------------
const ytArg = process.argv.find((a) => a.startsWith('--youtube'));
if (ytArg) {
  const budget = ytArg.includes('=') ? Number(ytArg.split('=')[1]) : Infinity;
  const env = Object.fromEntries(readFileSync(join(root, 'server', '.env'), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]));
  const tok = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: env.YT_CLIENT_ID, client_secret: env.YT_CLIENT_SECRET, refresh_token: env.YT_REFRESH_TOKEN, grant_type: 'refresh_token' }) })).json();
  if (!tok.access_token) throw new Error(`YouTube token: ${tok.error}`);
  const auth = { Authorization: `Bearer ${tok.access_token}` };
  let spent = 0;
  for (const t of TUNES.filter((x) => !cache[x.id].shorts)) {
    if (spent >= budget) break;
    const [s1, s] = await get(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoDuration=short&maxResults=25&q=${encodeURIComponent(t.q + ' guitar')}`, auth);
    if (s1 !== 200) { console.warn(`youtube: ${s.error?.message} — stopping`); break; }
    spent++;
    const hits = s.items.filter((i) => t.match.some((k) => i.snippet.title.toLowerCase().includes(k)));
    const [, v] = hits.length ? await get(`https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${hits.map((h) => h.id.videoId).join(',')}`, auth) : [0, { items: [] }];
    const secs = (d) => { const m = d.match(/PT(?:(\d+)M)?(?:(\d+)S)?/) ?? []; return 60 * (+m[1] || 0) + (+m[2] || 0); };
    const views = v.items.filter((i) => secs(i.contentDetails.duration) <= 180).map((i) => +i.statistics.viewCount || 0).sort((a, b) => a - b);
    const top = v.items.reduce((a, i) => (+i.statistics.viewCount > +(a?.statistics.viewCount ?? -1) ? i : a), null);
    cache[t.id].shorts = { at: new Date().toISOString().slice(0, 10), results: s.items.length, matched: views.length, median: views.length ? views[Math.floor(views.length / 2)] : 0, top: views.at(-1) ?? 0, topTitle: top ? hits.find((h) => h.id.videoId === top.id)?.snippet.title : null };
    console.log(`youtube: ${t.id} — ${views.length}/${s.items.length} matched, median ${cache[t.id].shorts.median}, top ${cache[t.id].shorts.top}`);
    save();
  }
  console.log(`youtube: ${spent} searches ≈ ${spent * 101} quota units`);
}

// --- score and write ---------------------------------------------------------------------------------------------------------------------
const signals = { wiki: (c) => c.wiki, median: (c) => c.shorts?.median, top: (c) => c.shorts?.top };
const pct = {};
for (const [k, f] of Object.entries(signals)) {
  const vals = TUNES.map((t) => f(cache[t.id])).filter((v) => v > 0).map(Math.log).sort((a, b) => a - b);
  pct[k] = (v) => (v > 0 && vals.length > 1 ? vals.findIndex((x) => x >= Math.log(v)) / (vals.length - 1) : null);
}
const rows = TUNES.map((t) => {
  const c = cache[t.id], ps = Object.entries(signals).map(([k, f]) => pct[k](f(c))).filter((p) => p !== null);
  return { t, c, score: ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : 0, n: ps.length };
}).sort((a, b) => b.score - a.score);
const k = (v) => (v == null ? '—' : v >= 1e6 ? `${(v / 1e6).toFixed(1)} M` : v >= 1e3 ? `${Math.round(v / 1e3)} K` : String(v));
const md = [
  '# Tune ranking',
  '',
  `Generated by \`node scripts/tune-rank.mjs\` on ${now.toISOString().slice(0, 10)}. How it is built and what each column means: the header of that script.`,
  `Wikipedia: ${ymd(start)}–${ymd(end)}. YouTube Shorts searched for ${rows.filter((r) => r.c.shorts).length} of ${rows.length} tunes. Score 0–1 = mean percentile of the signals present (n).`,
  '',
  '| # | tune | score (n) | Wikipedia views/yr | guitar Shorts matched | median | top | ours (IG views) |',
  '|---|---|---|---|---|---|---|---|',
  ...rows.map((r, i) => `| ${i + 1} | ${r.t.title}${r.t.pd === false ? ' *(not PD)*' : ''} | ${r.score.toFixed(2)} (${r.n}) | ${k(r.c.wiki)} | ${r.c.shorts ? `${r.c.shorts.matched}/${r.c.shorts.results}` : '—'} | ${k(r.c.shorts?.median)} | ${k(r.c.shorts?.top)} | ${r.t.ours ?? ''} |`),
  '',
].join('\n');
writeFileSync(OUT, md);
console.log(md);
