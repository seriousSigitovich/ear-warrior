import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildInstagram, buildYoutube, normalizeTags, utmUrl } from './text.js';
import { PublishError } from './types.js';

test('normalizeTags accepts #tags, commas and spaces, strips junk and de-duplicates', () => {
  assert.deepEqual(normalizeTags('#guitar #EarTraining, guitar  play-by-ear'), ['guitar', 'EarTraining', 'playbyear']);
  assert.deepEqual(normalizeTags(['#a', 'b c', 'A']), ['a', 'b', 'c']);
  assert.deepEqual(normalizeTags(undefined), []);
});

test('utmUrl matches the landing page source tags (youtube:ear31:desc)', () => {
  assert.equal(utmUrl({ platform: 'youtube', videoNo: 31 }), 'https://earwarrior.app/?utm_source=youtube&utm_campaign=ear31&utm_content=desc');
  assert.equal(utmUrl({ platform: 'youtube', videoNo: 7 }), 'https://earwarrior.app/?utm_source=youtube&utm_campaign=ear07&utm_content=desc');
  assert.equal(utmUrl({ platform: 'youtube', videoNo: null }), 'https://earwarrior.app/?utm_source=youtube&utm_content=desc');
});

test('buildYoutube: title, description with tracking link, #Shorts and hashtags; API tags without #', () => {
  const y = buildYoutube({ title: ' Can you play this by ear? ', description: 'One listen. Write the notes below.', tags: ['guitar', 'eartraining'], videoNo: 31 });
  assert.equal(y.title, 'Can you play this by ear?');
  assert.match(y.description, /^One listen\. Write the notes below\./);
  assert.match(y.description, /utm_source=youtube&utm_campaign=ear31&utm_content=desc/);
  assert.match(y.description, /#Shorts #guitar #eartraining$/);
  assert.deepEqual(y.tags, ['guitar', 'eartraining']);
});

test('buildYoutube with short: false is a regular video — no #Shorts hashtag', () => {
  const y = buildYoutube({ title: 'T', description: 'D', tags: ['guitar'], videoNo: 45, short: false });
  assert.doesNotMatch(y.description, /#Shorts/);
  assert.match(y.description, /#guitar$/);
  assert.match(y.description, /utm_campaign=ear45/);
});

test('buildYoutube refuses over-long titles and empty titles, naming the limit', () => {
  assert.throws(() => buildYoutube({ title: 'x'.repeat(101), description: 'd', tags: [], videoNo: 1 }), (e: Error) => e instanceof PublishError && /101/.test(e.message) && /100/.test(e.message));
  assert.throws(() => buildYoutube({ title: '  ', description: 'd', tags: [], videoNo: 1 }), /title/i);
});

test('buildYoutube refuses more than 15 hashtags (YouTube ignores them all) and over-long descriptions', () => {
  const tags = Array.from({ length: 15 }, (_, i) => `t${i}`); // + #Shorts = 16
  assert.throws(() => buildYoutube({ title: 't', description: 'd', tags, videoNo: 1 }), /15/);
  assert.throws(() => buildYoutube({ title: 't', description: 'x'.repeat(5000), tags: [], videoNo: 1 }), /5000|5 000/);
});

test('buildInstagram: caption + hashtags, no link; limits enforced', () => {
  const i = buildInstagram({ caption: 'No tabs. No chords. Just your ear.', tags: ['guitar', 'playbyear'] });
  assert.equal(i.caption, 'No tabs. No chords. Just your ear.\n\n#guitar #playbyear');
  assert.doesNotMatch(i.caption, /http/);
  assert.throws(() => buildInstagram({ caption: 'x', tags: Array.from({ length: 31 }, (_, n) => `t${n}`) }), /30/);
  assert.throws(() => buildInstagram({ caption: 'x'.repeat(2201), tags: [] }), /2200|2 200/);
  assert.throws(() => buildInstagram({ caption: ' ', tags: [] }), /empty/i);
});
