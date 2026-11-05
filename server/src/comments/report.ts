// Comments + answer key → the inbox: each unanswered comment with its verdict and a reply draft. Pure (report.test.ts).
import { draftReply, grade, NAMED_REPLY, namesTune, parseAnswer, pcName, type Grade } from './answer.js';
import type { Comment } from './sources.js';

export interface KeyEntry {
  videoNo: number | null;
  tune: string;
  title?: string;
  notes: number[];
  /** Names people call the tune by (answer-key.mjs ALIASES). */
  aliases?: string[];
  posts: Partial<Record<'youtube' | 'instagram', string>>;
}

export interface Row {
  comment: Comment;
  videoNo: number | null;
  tune: string | null;
  /** null: no answer in the comment, or no key for the video. */
  grade: Grade | null;
  reply: string | null;
  status: 'correct' | 'partial' | 'wrong' | 'named' | 'no answer' | 'no key';
}

export function buildRows(comments: Comment[], key: KeyEntry[]): Row[] {
  const byPost = new Map<string, KeyEntry>();
  for (const k of key) for (const id of Object.values(k.posts)) if (id) byPost.set(id, k);
  return comments.map((c) => {
    const k = byPost.get(c.postId) ?? null;
    const parsed = parseAnswer(c.text);
    if (!parsed) {
      const named = !!k && namesTune(c.text, k.aliases ?? []);
      return { comment: c, videoNo: k?.videoNo ?? null, tune: k?.tune ?? null, grade: null, reply: named ? NAMED_REPLY : null, status: named ? 'named' : 'no answer' };
    }
    if (!k) return { comment: c, videoNo: null, tune: null, grade: null, reply: null, status: 'no key' };
    const g = grade(parsed, k.notes);
    return { comment: c, videoNo: k.videoNo, tune: k.tune, grade: g, reply: draftReply(g), status: g.verdict };
  });
}

const ICON: Record<Row['status'], string> = { correct: '✅', partial: '🟡', wrong: '❌', named: '🏷', 'no answer': '💬', 'no key': '❔' };
const oneLine = (s: string) => s.replace(/\s*\n\s*/g, ' / ').trim();

function detail(r: Row): string {
  const g = r.grade;
  if (!g) return r.status === 'no key' ? 'похоже на ответ, но ключа для этого видео нет — проверьте сами' : r.status === 'named' ? 'назвал мелодию верно (без нот)' : '';
  const kind = { names: 'ноты', tab: 'таб', frets: 'лады' }[g.kind];
  const key = g.shift ? `, в другой тональности (${g.shift > 0 ? '+' : ''}${g.shift})` : '';
  const miss = g.miss ? `; ${g.miss.at + 1}-я нота: у человека ${g.miss.said}, в мелодии ${g.miss.expected}` : '';
  return `${kind}: верно ${g.matched} из ${g.given} написанных (в мелодии ${g.total})${key}${miss}`;
}

/** Markdown inbox. `all`: include threads we already answered. */
export function renderInbox(rows: Row[], opts: { all: boolean; key: KeyEntry[]; now: Date; problems: string[] }): string {
  const shown = rows.filter((r) => opts.all || !r.comment.answered);
  const count = (s: Row['status']) => shown.filter((r) => r.status === s).length;
  const lines = [
    `# Comments inbox`,
    '',
    `Built ${opts.now.toISOString().slice(0, 16).replace('T', ' ')} UTC by \`npm run comments\` (server/). ` +
      `${opts.all ? 'All comments' : 'Only threads the channel has not answered yet'}: ${shown.length} of ${rows.length}.`,
    '',
    `✅ ${count('correct')} верно · 🟡 ${count('partial')} частично · ❌ ${count('wrong')} мимо · 🏷 ${count('named')} назвали мелодию · ❔ ${count('no key')} без ключа · 💬 ${count('no answer')} не ответ`,
    '',
    'Черновик ответа — предложение, не отправлено. Проверка сравнивает высоты без октав и допускает другую тональность.',
    '',
  ];
  for (const p of opts.problems) lines.push(`> ⚠ ${p}`, '');

  // Answers first (the work), then everything else; newest first inside each group.
  const order: Row['status'][] = ['partial', 'wrong', 'correct', 'named', 'no key', 'no answer'];
  const sorted = [...shown].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || b.comment.at.localeCompare(a.comment.at));
  let section = '';
  for (const r of sorted) {
    const head = r.status === 'no answer' ? 'Остальные комментарии' : 'Ответы';
    if (head !== section) {
      lines.push(`## ${head}`, '');
      section = head;
    }
    const c = r.comment;
    const video = r.videoNo ? `#${r.videoNo}` : '';
    const tune = r.tune ? ` (${r.tune})` : '';
    lines.push(
      `### ${ICON[r.status]} ${c.author} — ${c.platform === 'youtube' ? 'YT' : 'IG'} ${video}${tune}${c.answered ? ' · уже ответили' : ''}`,
      '',
      `> ${oneLine(c.text)}`,
      '',
    );
    const d = detail(r);
    if (d) lines.push(d, '');
    if (r.reply) lines.push(`Черновик: ${r.reply}`, '');
    lines.push(`[${oneLine(c.postTitle) || 'пост'}](${c.postUrl}) · ${c.at.slice(0, 10)}`, '');
  }
  if (!shown.length) lines.push('Новых комментариев без ответа нет.', '');

  const melodies = opts.key.map((k) => `- #${k.videoNo ?? '—'} ${k.tune}: ${k.notes.map((n) => pcName(n % 12)).join(' ')}`);
  lines.push('<details><summary>Ключ: мелодии видео</summary>', '', ...melodies, '', '</details>', '');
  return lines.join('\n');
}
