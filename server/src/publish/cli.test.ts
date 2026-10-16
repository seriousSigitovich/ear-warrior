import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadLedger } from './ledger.js';
import { runPublish, type Deps } from './run.js';
import type { Probe } from './video.js';

const goodProbe: Probe = { durationS: 26.1, width: 1080, height: 1920, videoCodec: 'h264', audioCodec: 'aac', sizeBytes: 3000 };
const FILE = '/repo/assets/video/challenge/out/H14_youtube-A/ear-challenge-31.mp4';
const env = { YT_CLIENT_ID: 'a', YT_CLIENT_SECRET: 'b', YT_UPLOAD_REFRESH_TOKEN: 'c', IG_PUBLISH_TOKEN: 'IGTOKEN' };

const json = (b: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(b), { status: 200, ...init });

/** Scripted platforms; `fail` makes one of them reject. */
function platforms(fail?: 'youtube' | 'instagram') {
  const urls: string[] = [];
  const fetchFn = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    urls.push(`${method} ${url}`);
    if (/oauth2\.googleapis/.test(url)) return json({ access_token: 'AT' });
    if (/upload\/youtube\/v3\/videos/.test(url)) {
      if (fail === 'youtube') return json({ error: { message: 'quota exceeded' } }, { status: 403 });
      return new Response('', { status: 200, headers: { location: 'https://upload.example/s' } });
    }
    if (/upload\.example/.test(url)) return json({ id: 'yt1' });
    if (/\/me\/media$/.test(url)) {
      if (fail === 'instagram') return json({ error: { message: 'Invalid OAuth access token' } }, { status: 400 });
      return json({ id: 'c1' });
    }
    if (/\/c1\?/.test(url)) return json({ status_code: 'FINISHED' });
    if (/media_publish/.test(url)) return json({ id: 'm1' });
    if (/\/m1\?/.test(url)) return json({ permalink: 'https://www.instagram.com/reel/XyZ/' });
    return json({ error: { message: `unexpected ${method} ${url}` } }, { status: 500 });
  }) as typeof fetch;
  return { fetchFn, urls };
}

const hostSpy = {
  uploaded: 0,
  removed: 0,
  host: async () => {
    hostSpy.uploaded++;
    return { url: 'https://blob.example/publish/x.mp4', remove: async () => void hostSpy.removed++ };
  },
};

function setup(over: Partial<Deps> = {}) {
  hostSpy.uploaded = 0;
  hostSpy.removed = 0;
  const dir = mkdtempSync(join(tmpdir(), 'ew-cli-'));
  const out: string[] = [];
  const p = platforms();
  const deps: Deps = {
    env,
    fetchFn: p.fetchFn,
    probe: async () => goodProbe,
    readFile: async () => new Uint8Array(3000),
    host: hostSpy.host,
    ledgerPath: join(dir, 'published.json'),
    repoRoot: '/repo',
    now: () => new Date('2026-10-16T12:00:00Z'),
    sleep: async () => {},
    out: (l) => out.push(l),
    ...over,
  };
  return { deps, out, ledgerPath: deps.ledgerPath, urls: p.urls };
}

const args = (...a: string[]) => ['--file', FILE, '--title', 'Can you play this by ear?', '--description', 'One listen.', '--tags', '#guitar #eartraining', ...a];

test('DRY RUN is the default: prints the plan, makes no network call, writes nothing', async () => {
  const s = setup({ fetchFn: (async () => { throw new Error('network must not be touched in a dry run'); }) as typeof fetch });
  const code = await runPublish(args(), s.deps);
  assert.equal(code, 0);
  const text = s.out.join('\n');
  assert.match(text, /dry run/i);
  assert.match(text, /nothing was sent/i);
  assert.match(text, /Can you play this by ear\?/);
  assert.match(text, /utm_campaign=ear31/);
  assert.match(text, /#guitar #eartraining/);
  assert.deepEqual(loadLedger(s.ledgerPath), []);
});

test('the plan never prints a credential', async () => {
  const s = setup();
  await runPublish(args(), s.deps);
  assert.doesNotMatch(s.out.join('\n'), /IGTOKEN/);
});

test('--confirm publishes to both, records both, and prints the links', async () => {
  const s = setup();
  const code = await runPublish(args('--confirm'), s.deps);
  assert.equal(code, 0);
  const text = s.out.join('\n');
  assert.match(text, /youtube\.com\/shorts\/yt1/);
  assert.match(text, /instagram\.com\/reel\/XyZ/);
  assert.match(text, /studio\.youtube\.com\/video\/yt1\/edit/);
  const ledger = loadLedger(s.ledgerPath);
  assert.deepEqual(ledger.map((e) => [e.platform, e.postId, e.visibility, e.videoNo]).sort(), [['instagram', 'm1', 'public', 31], ['youtube', 'yt1', 'private', 31]]);
  assert.equal(ledger[0]!.file, 'assets/video/challenge/out/H14_youtube-A/ear-challenge-31.mp4');
  assert.doesNotMatch(readFileSync(s.ledgerPath, 'utf8'), /IGTOKEN|AT"/);
});

test('a file already published to a platform is refused there unless --force', async () => {
  const s = setup();
  await runPublish(args('--confirm'), s.deps);
  s.out.length = 0;
  const again = await runPublish(args('--confirm'), s.deps);
  assert.equal(again, 1); // nothing left to publish
  assert.match(s.out.join('\n'), /already published/i);
  assert.equal(loadLedger(s.ledgerPath).length, 2);
  const forced = await runPublish(args('--confirm', '--force', '--platforms', 'youtube'), s.deps);
  assert.equal(forced, 0);
  assert.equal(loadLedger(s.ledgerPath).length, 3);
});

test('one platform failing does not stop the other; exit status is 1', async () => {
  const p = platforms('instagram');
  const s = setup({ fetchFn: p.fetchFn });
  const code = await runPublish(args('--confirm'), s.deps);
  assert.equal(code, 1);
  const text = s.out.join('\n');
  assert.match(text, /Invalid OAuth access token/);
  assert.doesNotMatch(text, /IGTOKEN/);
  assert.deepEqual(loadLedger(s.ledgerPath).map((e) => e.platform), ['youtube']);
});

test('--no-publish stages the Instagram Reel only: processed, never published, not recorded', async () => {
  const s = setup();
  const code = await runPublish(args('--confirm', '--platforms', 'instagram', '--no-publish'), s.deps);
  assert.equal(code, 0);
  assert.ok(!s.urls.some((u) => /media_publish/.test(u)));
  assert.match(s.out.join('\n'), /staged/i);
  assert.deepEqual(loadLedger(s.ledgerPath), []);
});

test('a file a platform cannot take is blocked with the reason, even with --confirm', async () => {
  const s = setup({ probe: async () => ({ ...goodProbe, width: 1920, height: 1080 }) });
  const code = await runPublish(args('--confirm'), s.deps);
  assert.equal(code, 1);
  assert.match(s.out.join('\n'), /not vertical/i);
  assert.equal(s.urls.length, 0);
});

test('a text over the limit blocks only that platform', async () => {
  const s = setup();
  const code = await runPublish(['--file', FILE, '--title', 'x'.repeat(120), '--description', 'ok', '--confirm'], s.deps);
  assert.equal(code, 0); // Instagram still goes out (caption falls back to the description)
  assert.match(s.out.join('\n'), /YouTube title is 120/);
  assert.deepEqual(loadLedger(s.ledgerPath).map((e) => e.platform), ['instagram']);
});

test('missing required input is explained', async () => {
  const s = setup();
  assert.equal(await runPublish([], s.deps), 2);
  assert.match(s.out.join('\n'), /--file/);
});

test('the temporary public copy is created only for Instagram and always deleted afterwards', async () => {
  const ok = setup();
  await runPublish(args('--confirm', '--platforms', 'instagram'), ok.deps);
  assert.deepEqual([hostSpy.uploaded, hostSpy.removed], [1, 1]);

  const bad = setup({ fetchFn: platforms('instagram').fetchFn });
  await runPublish(args('--confirm', '--platforms', 'instagram'), bad.deps);
  assert.deepEqual([hostSpy.uploaded, hostSpy.removed], [1, 1], 'deleted even when Instagram fails');

  const yt = setup();
  await runPublish(args('--confirm', '--platforms', 'youtube'), yt.deps);
  assert.deepEqual([hostSpy.uploaded, hostSpy.removed], [0, 0], 'YouTube never uses the public copy');

  const dry = setup();
  await runPublish(args(), dry.deps);
  assert.deepEqual([hostSpy.uploaded, hostSpy.removed], [0, 0], 'a dry run hosts nothing');
});
