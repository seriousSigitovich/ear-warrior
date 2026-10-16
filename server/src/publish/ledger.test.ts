import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { addEntry, findEntry, loadLedger, relativeFile, type Entry } from './ledger.js';

const entry = (over: Partial<Entry> = {}): Entry => ({
  file: 'assets/video/challenge/out/H14_youtube-A/ear-challenge-31.mp4',
  videoNo: 31,
  platform: 'youtube',
  postId: 'abc123',
  url: 'https://www.youtube.com/shorts/abc123',
  visibility: 'private',
  title: 'Can you play this by ear?',
  publishedAt: '2026-10-16T12:00:00.000Z',
  ...over,
});
const tmp = () => join(mkdtempSync(join(tmpdir(), 'ew-ledger-')), 'published.json');

test('a missing ledger is empty', () => {
  assert.deepEqual(loadLedger(tmp()), []);
});

test('addEntry persists, findEntry matches file + platform only', () => {
  const p = tmp();
  addEntry(p, entry());
  addEntry(p, entry({ platform: 'instagram', postId: 'ig1', url: 'https://instagram.com/reel/x/', visibility: 'public' }));
  const all = loadLedger(p);
  assert.equal(all.length, 2);
  assert.equal(findEntry(all, entry().file, 'youtube')?.postId, 'abc123');
  assert.equal(findEntry(all, entry().file, 'instagram')?.postId, 'ig1');
  assert.equal(findEntry(all, 'other.mp4', 'youtube'), undefined);
  assert.match(readFileSync(p, 'utf8'), /\n$/); // pretty JSON, trailing newline
});

test('the ledger never stores anything but the declared fields (no secrets can sneak in)', () => {
  const p = tmp();
  addEntry(p, { ...entry(), token: 'SECRET' } as Entry);
  assert.doesNotMatch(readFileSync(p, 'utf8'), /SECRET/);
});

test('a corrupt ledger is reported, not overwritten', () => {
  const p = tmp();
  writeFileSync(p, '{not json');
  assert.throws(() => loadLedger(p), /published\.json|ledger/i);
});

test('relativeFile makes repo-relative forward-slash paths', () => {
  assert.equal(relativeFile('/repo/assets/video/x.mp4', '/repo'), 'assets/video/x.mp4');
});
