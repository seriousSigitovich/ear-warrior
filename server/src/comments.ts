// `npm run comments [-- --all]`: reads the comments under our YouTube Shorts and Instagram Reels, checks the notes people wrote
// against each video's melody (docs/answer-key.json, from `node answer-key.mjs` in assets/video/remotion) and writes
// docs/comments-inbox.md: unanswered comments, a verdict and a reply draft for each. Posts nothing.
//   --all              include threads the channel has already answered
//   --reply            PLAN: list the replies that would be posted (unanswered threads with an answer in them), send nothing
//   --reply --confirm  post those replies as the channel/account
//   --skip=<id,id>     leave these comment ids out of --reply (ids are printed by the plan)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRows, renderInbox, type KeyEntry } from './comments/report.js';
import { instagramComments, postReply, youtubeAccessToken, youtubeComments, type Comment } from './comments/sources.js';

const repo = join(process.cwd(), '..');
const args = process.argv.slice(2);
const all = args.includes('--all');
const reply = args.includes('--reply');
const confirm = args.includes('--confirm');
const skip = new Set((args.find((a) => a.startsWith('--skip='))?.slice(7) ?? '').split(',').filter(Boolean));
const env = process.env;

const key = JSON.parse(readFileSync(join(repo, 'docs/answer-key.json'), 'utf8')) as KeyEntry[];
const comments: Comment[] = [];
const problems: string[] = [];

const ytToken = env.YT_COMMENTS_REFRESH_TOKEN;
let ytAccess: string | undefined;
if (!ytToken) problems.push('YouTube пропущен: нет YT_COMMENTS_REFRESH_TOKEN — запустите `npm run yt:auth -- --comments`.');
else {
  try {
    ytAccess = await youtubeAccessToken(fetch, env, ytToken);
    comments.push(...(await youtubeComments(fetch, ytAccess)));
  } catch (err) {
    problems.push(`YouTube: ${(err as Error).message}`);
  }
}

const igToken = env.IG_COMMENTS_TOKEN;
if (!igToken) problems.push('Instagram пропущен: нет IG_COMMENTS_TOKEN (токен с instagram_business_manage_comments, см. server/README.md → Comments).');
else {
  try {
    comments.push(...(await instagramComments(fetch, igToken)));
  } catch (err) {
    problems.push(`Instagram: ${(err as Error).message}`);
  }
}

const rows = buildRows(comments, key);
const out = join(repo, 'docs/comments-inbox.md');
writeFileSync(out, renderInbox(rows, { all, key, now: new Date(), problems }));

const open = rows.filter((r) => !r.comment.answered);
const n = (s: string) => open.filter((r) => r.status === s).length;
console.log(`${comments.length} comments read, ${open.length} without our reply: ` +
  `${n('correct')} correct, ${n('partial')} partial, ${n('wrong')} wrong, ${n('named')} named the tune, ${n('no key')} no key, ${n('no answer')} not an answer`);
for (const p of problems) console.log(`! ${p}`);
console.log(`→ docs/comments-inbox.md`);

if (reply) {
  const todo = open.filter((r) => r.reply && !skip.has(r.comment.commentId));
  console.log(`\n${confirm ? 'Posting' : 'PLAN (nothing sent; add --confirm to post)'}: ${todo.length} replies`);
  let failed = 0;
  for (const r of todo) {
    const c = r.comment;
    const head = `[${c.platform === 'youtube' ? 'YT' : 'IG'} #${r.videoNo ?? '—'} ${r.status}] ${c.author} (${c.commentId})`;
    if (!confirm) {
      console.log(`${head}\n   «${c.text.replace(/\s*\n\s*/g, ' / ').slice(0, 140)}»\n   → ${r.reply}`);
      continue;
    }
    try {
      await postReply(fetch, c, r.reply!, { youtube: ytAccess, instagram: igToken });
      console.log(`✓ ${head}`);
    } catch (err) {
      failed++;
      console.log(`✗ ${head}: ${(err as Error).message}`);
    }
  }
  if (failed) process.exitCode = 1;
}
