// Classifies collected Reddit posts by the user's intent (what they are stuck on) and reports counts and overlaps.
// Rules were tuned by reading ~1080 of the 2000 posts; run with --sample N to eyeball precision per bucket.
// Usage: node scripts/research/analyze-pains.mjs [inFile] [outFile] [--sample N] [--from IDX]
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i === -1 ? dflt : Number(args[i + 1]);
};
const SAMPLE = flag('--sample', 0);
const FROM = flag('--from', 0);
const pos = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const IN = pos[0] ?? 'docs/research/reddit-posts.jsonl';
const OUT = pos[1] ?? 'docs/research/reddit-pains.md';

const clean = (s) => (s === '[removed]' || s === '[deleted]' ? '' : s ?? '').replace(/https?:\S+/g, ' ');
const rows = readFileSync(IN, 'utf8').trim().split('\n').map((l, i) => {
  const r = JSON.parse(l);
  return { ...r, idx: i, title: r.title ?? '', body: clean(r.selftext) };
});

const EAR_WORDS = /by ear|figure (it |this |songs? |that |the \w+ )?out|transcrib|pick(ing)? (it |songs? |chords? )?out|ear.?training|hear(ing)? (the |what )?(note|chord|melod|pitch|key)|play what (i|you) hear/i;
const TUNING_INSTRUMENT = /tun(e|ing|er)\b[^.?!]{0,25}by ear|by ear[^.?!]{0,25}\btun(e|ing)|\btuner|intonation|\bin tune\b|out of tune|tune (my|the|a|your) (guitar|strings?)|\bpitch(es)? (shift|correct)|432/i;
const GEAR_NOISE = /\bamp(s|lifier)?\b|pickups?|pedal|\bNGD\b|\[GEAR\]|\bstrat\b|les paul|earplug|ear protection|ear.?piercing|ear.?bud/i;

const T = (r) => r.title;
const A = (r) => `${r.title}\n${r.body}`;

// Each rule: [id, label, test]. A post may match several; the first match in PRIMARY_ORDER becomes its primary bucket.
const RULES = {
  success: ['показывают результат («я подобрал сам»)', (r) => /^(\[play\]|\[cover\])|\b(my|a) (first |own )?(cover|recording|transcription|version|rendition|attempt)\b|\bi (just |finally )?(learned|figured|tabbed|transcribed|played|recorded|did)\b[^?]{0,60}by ear|\bby ear\b[^?]{0,20}(cover|!)|first (song|time)[^?]{0,30}by ear/i.test(T(r)) && !/\?|help|tips?|advice|how/i.test(T(r))],
  askTab: ['просят других сделать таб/аккорды («не могу сам, табов нет»)', (r) => {
    const req = /(can|could|would|will|does|do) (some|any)(one|body|of you)|anyone (help|know|have|tab|got|able|here|else)|help me|please|tab request|\[request\]|\[tab|tab(bing)? help|help (with|me)? ?(tab|learn|figur)|(somebody|someone) (tab|help|write|transcribe|figure)|\bneed (a |the )?(tab|chords)|looking for (a |the )?(tab|chords)|where (can|do) i (find|get|request)/i.test(A(r));
    const cant = /can'?t (really |even |quite |just )?(play|learn|do|figure|find|work|get|hear|pick|tab|transcribe|identify)|cannot|not (very |that |really )?(good|great|able|skilled|experienced|talented|musical|advanced)[^.]{0,30}(ear|enough|by ear|figur|learn|transcrib)|bad at|terrible at|(suck|awful|horrible) (at )?(it|by ear|learning|playing|figuring)|no tabs?|nobody has tabbed|can'?t find (a |any |the )?(tabs?|chords?)|(don'?t|do not) have the ear|my ear (isn'?t|is not|is) (good|trained|developed|rusty)|not there yet|beyond me|too hard/i.test(A(r));
    return req && (cant || /\btabs?\b|chords? (for|to)|what chords/i.test(T(r))) && EAR_WORDS.test(A(r)) || (req && cant && /\btab\b|tabs\b|chords/i.test(T(r)));
  }],
  startHow: ['не знают, с чего начать и как тренировать слух', (r) => {
    const t = T(r);
    return (/(how|where|what).{0,50}(learn|start|begin|train|practice|improve|develop|get better|do (i|you))|tips?\b|advice|\bhelp\b|\bstart(ing)?\b|methods?|steps?|secret|resources?|sites?|exercises?|recommend|suggest|good (songs?|albums?)|easy (songs?|melodies)|songs? to (learn|start|practice)/i.test(t) && /by ear|ear.?training|play(ing)? by ear|learn(ing)? songs?|transcrib/i.test(t)) ||
      /how (do|did|can|should) (i|you|one|people) (even )?(learn|play|start|begin)[^?]{0,40}by ear|(want|trying|wanting|need) to (learn|start|get into|develop)[^.]{0,40}(by ear|my ear)|never (learned|played|done)[^.]{0,30}by ear|(can'?t|cannot|unable to) (play|learn|do) (anything |songs? )?by ear|stop (using|relying)[^.]{0,20}tabs|(rely|reliant|dependent)[^.]{0,25}tabs/i.test(A(r)) && /\?|help|tips?|advice|how/i.test(A(r));
  }],
  chords: ['аккорды, тональность, прогрессия на слух', (r) => /\bchords?\b|progression|\bkey\b|harmon/i.test(T(r)) && EAR_WORDS.test(A(r)) || /(figur|find|identify|hear|pick|get|work|decipher)\w* (out )?(the )?(chords?|key|progression)|chords? (by ear|are|is) (hard|difficult)|(struggl|trouble|hard time|difficult)\w*[^.]{0,40}chords?|(only|can) (pick|get|figure|hear)[^.]{0,30}(melod|riff|lead|single)[^.]{0,40}(but|not)[^.]{0,30}chords?/i.test(A(r)) && EAR_WORDS.test(A(r))],
  hardParts: ['застряли на конкретной сложной партии (соло, бенд, слайд, строй, быстро)', (r) => /by ear|figure|transcrib|pick(ing)? (it |that )?out|tab(bing)? (it|this|that)/i.test(A(r)) && /\b(solo|lick|riff|fill|run|intro|outro|bend|slide|tapping|fingerpick\w*|arpeggio|bridge|part|section|tuning|palm|harmonic|fast|speed)\b[^.!?]{0,80}(can'?t|cannot|couldn'?t|stuck|trouble|hard|difficult|struggl|lost|baffl|stump|impossible|no luck|forever|for the life of me|too fast)|(can'?t|cannot|couldn'?t|stuck|trouble|hard time|difficult|struggl|lost|impossible)[^.!?]{0,80}\b(solo|lick|riff|fill|run|intro|outro|bend|slide|tapping|arpeggio|bridge|part|section|tuning|fast)\b/i.test(A(r))],
  tools: ['ищут инструмент (замедлить, зациклить, тренажёр слуха, приложение)', (r) => /(\bapps?\b|software|program|website|\bsite\b|slow(er|ing)? (it |the )?(song |music |track )?down|\bloop(er|ing)?\b|a-?b repeat|speed control|amazing slow|ear.?master|\btool\b|quiz)[^.!?]{0,100}(by ear|ear.?training|transcrib|learn(ing)? songs|chord recogn|identify (notes|chords|intervals))|(by ear|ear.?training|transcrib|learn(ing)? songs|chord recogn|identify (notes|chords|intervals))[^.!?]{0,100}(\bapps?\b|software|program|website|\bsite\b|slow(er|ing)? (it |the )?(song |music |track )?down|\bloop(er|ing)?\b|a-?b repeat|speed control|amazing slow|ear.?master|\btool\b|quiz)/i.test(A(r)) && /\?|looking|recommend|suggest|anyone know|is there|does anyone|best/i.test(A(r))],
  tabDependence: ['зависимость от табов, чувство «я не настоящий музыкант»', (r) => /(rely|reliant|dependen|crutch|stop using|without (using )?tabs|only (learned|play|know|use)[^.]{0,20}tabs|always (use|used|looked)[^.]{0,15}tabs|tabs? (are|is) (bad|evil|cheating|a crutch|restrictive|holding)|feel (bad|guilty)[^.]{0,20}tabs|tabitis|(lazy|cheating)[^.]{0,30}tabs|purist)/i.test(A(r)) && /\btabs?\b/i.test(A(r))],
  theoryGap: ['играют на слух, но не знают теорию/ноты (разрыв слух ↔ теория)', (r) => /by ear|play(ing)? by ear/i.test(A(r)) && /(by ear|play(ed|ing)? only by ear|learned by ear)[^.]{0,90}(theory|read music|sheet music|scale names|chord names|notation)|(theory|read(ing)? (music|notes)|sheet music|notation)[^.]{0,90}(by ear)|no (formal |music )?theory|don'?t know (any |much )?(music )?theory|self.?taught[^.]{0,40}(by ear)|(i )?(know|have)[^.]{0,20}theory[^.]{0,60}(but|however)[^.]{0,50}(ear|hear)/i.test(A(r))],
  plateau: ['застой/мотивация (в т.ч. «только табы/копирую»)', (r) => /plateau|stuck|rut\b|stagnat|burn(ed|t) out|no motivation|lost (all )?motivation|getting nowhere|hit a wall|not improv|what next|where (do i|to) go from here|next step/i.test(A(r))],
};

// Order matters: a post lands in the first bucket it matches.
const PRIMARY_ORDER = ['success', 'askTab', 'startHow', 'chords', 'hardParts', 'tools', 'tabDependence', 'theoryGap', 'plateau'];

const classified = rows.map((r) => {
  const text = A(r);
  const tuning = TUNING_INSTRUMENT.test(text) && !/(learn|figure|play|pick)\w* (a |the |this |that )?(song|solo|riff|melody|chords?)/i.test(T(r)) && !/chords?|solo|riff|melody/i.test(T(r));
  const gear = GEAR_NOISE.test(T(r)) && !EAR_WORDS.test(T(r));
  const earRelated = EAR_WORDS.test(text) || /\btabs?\b/i.test(T(r));
  if (tuning || gear || !earRelated) return { ...r, primary: tuning ? 'тюнинг самого инструмента (не по теме)' : gear ? 'железо/шум (не по теме)' : 'не про подбор на слух', flags: [], topical: false };
  const flags = PRIMARY_ORDER.filter((k) => RULES[k][1](r));
  return { ...r, primary: flags.length ? RULES[flags[0]][0] : 'прочее про слух (без чёткой боли)', flags, topical: true };
});

const topical = classified.filter((r) => r.topical);
const painPosts = topical.filter((r) => r.flags.length && !r.flags.includes('success'));
const count = (arr, f) => arr.filter(f).length;
const pct = (n, d) => `${((n / d) * 100).toFixed(0)}%`;

// SAMPLE mode: print a few posts per primary bucket for manual precision checks.
if (SAMPLE) {
  const buckets = new Map();
  for (const r of classified.filter((x) => x.idx >= FROM)) {
    if (!buckets.has(r.primary)) buckets.set(r.primary, []);
    buckets.get(r.primary).push(r);
  }
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (const [name, list] of buckets) {
    console.log(`\n## ${name} (${list.length})`);
    list.sort(() => rnd() - 0.5).slice(0, SAMPLE).forEach((r) => console.log(`  - ${r.title.slice(0, 100)} :: ${r.body.replace(/\s+/g, ' ').slice(0, 120)}`));
  }
  process.exit(0);
}

const byPrimary = {};
for (const r of classified) byPrimary[r.primary] = (byPrimary[r.primary] ?? 0) + 1;

const flagCount = Object.fromEntries(PRIMARY_ORDER.map((k) => [k, count(painPosts, (r) => r.flags.includes(k))]));
const pairs = [];
for (let i = 0; i < PRIMARY_ORDER.length; i++) {
  for (let j = i + 1; j < PRIMARY_ORDER.length; j++) {
    const [a, b] = [PRIMARY_ORDER[i], PRIMARY_ORDER[j]];
    if (a === 'success' || b === 'success') continue;
    const both = count(painPosts, (r) => r.flags.includes(a) && r.flags.includes(b));
    if (both < 8) continue;
    const lift = both / painPosts.length / ((flagCount[a] / painPosts.length) * (flagCount[b] / painPosts.length));
    pairs.push({ a: RULES[a][0], b: RULES[b][0], both, lift });
  }
}
pairs.sort((x, y) => y.both - x.both);

const years = {};
for (const r of rows) years[new Date(r.created_utc * 1000).getFullYear()] = (years[new Date(r.created_utc * 1000).getFullYear()] ?? 0) + 1;
const snip = (s, n = 170) => s.replace(/\s+/g, ' ').slice(0, n);

let md = `# Боли гитаристов, подбирающих на слух (Reddit, r/Guitar)\n\n`;
md += `Всего постов: **${rows.length}** (${Object.entries(years).map(([y, c]) => `${y}: ${c}`).join(', ')}). Источник: Arctic Shift, только r/Guitar.\n\n`;
md += `Классификатор по смыслу запроса, настроен чтением ~1080 из 2000 постов; один пост может попасть в несколько болей, но в основную таблицу идёт один раз (по порядку приоритета).\n\n`;
md += `## Сколько постов вообще по теме\n\n| | Постов |\n|---|---|\n`;
md += `| По теме (подбор на слух / табы) | ${topical.length} (${pct(topical.length, rows.length)}) |\n`;
md += `| Из них с чёткой болью | ${painPosts.length} |\n`;
md += `| Не по теме (тюнинг гитары, железо, шум) | ${rows.length - topical.length} |\n\n`;
md += `## Основные боли (каждый пост один раз)\n\n| Боль | Постов | Доля от «с болью» |\n|---|---|---|\n`;
const primaryRows = painPosts.reduce((m, r) => ((m[r.primary] = (m[r.primary] ?? 0) + 1), m), {});
for (const [k, v] of Object.entries(primaryRows).sort((a, b) => b[1] - a[1])) md += `| ${k} | ${v} | ${pct(v, painPosts.length)} |\n`;
md += `\n## Сколько постов затрагивают боль (с учётом пересечений)\n\n| Боль | Постов | Доля |\n|---|---|---|\n`;
for (const k of PRIMARY_ORDER.filter((k) => k !== 'success').sort((a, b) => flagCount[b] - flagCount[a])) md += `| ${RULES[k][0]} | ${flagCount[k]} | ${pct(flagCount[k], painPosts.length)} |\n`;
md += `\n## Пересечения (чаще всего встречаются вместе)\n\n| Боль A | Боль B | Вместе | Lift |\n|---|---|---|---|\n`;
for (const p of pairs.slice(0, 12)) md += `| ${p.a} | ${p.b} | ${p.both} | ${p.lift.toFixed(2)} |\n`;
md += `\n## Примеры по болям (топ по оценке)\n`;
for (const k of PRIMARY_ORDER.filter((k) => k !== 'success')) {
  md += `\n### ${RULES[k][0]}\n`;
  painPosts.filter((r) => r.primary === RULES[k][0]).sort((a, b) => b.score - a.score).slice(0, 4)
    .forEach((p) => (md += `- [${snip(p.title, 90)}](${p.url}) (${p.score}) — ${snip(p.body)}\n`));
}
writeFileSync(OUT, md);
console.log(md.split('## Примеры')[0]);
