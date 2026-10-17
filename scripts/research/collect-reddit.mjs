// Collects Reddit posts about playing/figuring out music by ear from the Arctic Shift archive.
// Usage: node scripts/research/collect-reddit.mjs [outFile]
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const API = 'https://arctic-shift.photon-reddit.com/api/posts/search';
const OUT = process.argv[2] ?? 'docs/research/reddit-posts.jsonl';

const SUBREDDITS = ['guitar', 'guitarlessons', 'LearnGuitar', 'musictheory', 'Guitar_Theory', 'musicians', 'ear_training', 'acousticguitar'];
const QUERIES = [
  'by ear',
  'play by ear',
  'learn songs by ear',
  'figure out songs',
  'figure out melody',
  'transcribe by ear',
  'pick out melodies',
  'ear training',
  'can\'t hear the notes',
  'tabs',
  'improvise',
  'jam',
];
const PAGE = 100;
const DELAY_MS = 1200;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(params, attempt = 0) {
  const url = `${API}?${new URLSearchParams(params)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
    const json = await res.json();
    if (json.data) return json.data;
    throw new Error(json.error ?? `HTTP ${res.status}`);
  } catch (e) {
    if (attempt >= 5) {
      console.error(`give up: ${url} (${e.message})`);
      return null;
    }
    await sleep(3000 * (attempt + 1));
    return fetchPage(params, attempt + 1);
  }
}

mkdirSync(dirname(OUT), { recursive: true });
const seen = new Set();
if (existsSync(OUT)) {
  for (const line of readFileSync(OUT, 'utf8').split('\n')) {
    if (line) seen.add(JSON.parse(line).id);
  }
} else {
  writeFileSync(OUT, '');
}
console.log(`resuming with ${seen.size} posts`);

for (const subreddit of SUBREDDITS) {
  for (const query of QUERIES) {
    let after = '2010-01-01';
    let added = 0;
    for (;;) {
      const rows = await fetchPage({ subreddit, query, limit: PAGE, sort: 'asc', after });
      if (rows === null) {
        // page kept failing: skip 60 days ahead instead of losing the rest of the query
        const next = new Date(new Date(after).getTime() + 60 * 86400000);
        if (next > new Date()) break;
        after = next.toISOString();
        continue;
      }
      if (rows.length === 0) break;
      for (const p of rows) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        added++;
        appendFileSync(
          OUT,
          JSON.stringify({
            id: p.id,
            subreddit: p.subreddit,
            created_utc: p.created_utc,
            title: p.title,
            selftext: p.selftext,
            score: p.score,
            num_comments: p.num_comments,
            url: `https://reddit.com${p.permalink}`,
            matched: query,
          }) + '\n',
        );
      }
      const last = rows[rows.length - 1].created_utc;
      if (rows.length < PAGE) break;
      after = new Date(last * 1000).toISOString();
      await sleep(DELAY_MS);
    }
    console.log(`r/${subreddit} "${query}": +${added} (total ${seen.size})`);
    await sleep(DELAY_MS);
  }
}
console.log(`done: ${seen.size} posts -> ${OUT}`);
