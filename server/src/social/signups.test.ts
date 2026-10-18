import assert from 'node:assert/strict';
import { test } from 'node:test';
import { campaignOf, fetchUpstashSources, leadsForPost, loadLeads, mergeCounts, totalLeads } from './signups.js';

const resp = (body: unknown, ok = true, status = 200) => async () => ({ ok, status, json: async () => body });

test('campaignOf pads like the publish command', () => {
  assert.equal(campaignOf(7), 'ear07');
  assert.equal(campaignOf(44), 'ear44');
});

test('leadsForPost: platform and earNN must both match; no number -> null', () => {
  const s = [{ source: 'youtube:ear44:desc', count: 2 }, { source: 'youtube:ear44', count: 1 }, { source: 'instagram:ear44', count: 9 }];
  assert.equal(leadsForPost({ platform: 'youtube', videoNo: 44 }, s), 3);
  assert.equal(leadsForPost({ platform: 'youtube', videoNo: 45 }, s), 0);
  assert.equal(leadsForPost({ platform: 'youtube', videoNo: null }, s), null);
});

test('fetchUpstashSources: counts sources from a flat HGETALL and never returns emails', async () => {
  const env = { KV_REST_API_URL: 'https://u.example/', KV_REST_API_TOKEN: 't' };
  const out = await fetchUpstashSources(env, resp([{ result: ['a@x.com', 'youtube:ear44:desc', 'b@x.com', 'youtube:ear44:desc', 'c@x.com', 'landing'] }]));
  assert.deepEqual(out, [{ source: 'youtube:ear44:desc', count: 2 }, { source: 'landing', count: 1 }]);
  assert.doesNotMatch(JSON.stringify(out), /@x\.com/);
});

test('fetchUpstashSources: null when not configured, throws on an HTTP error', async () => {
  assert.equal(await fetchUpstashSources({}, resp([])), null);
  await assert.rejects(fetchUpstashSources({ KV_REST_API_URL: 'https://u', KV_REST_API_TOKEN: 't' }, resp({}, false, 500)), /upstash 500/);
});

test('loadLeads: Upstash first, Postgres fallback, null when both fail', async () => {
  const env = { KV_REST_API_URL: 'https://u', KV_REST_API_TOKEN: 't' };
  const pg = async () => [{ source: 'landing', count: 4 }];
  assert.equal((await loadLeads(env, resp([{ result: ['e', 'landing'] }]), pg))!.via, 'upstash');
  const fb = await loadLeads(env, resp({}, false, 500), pg);
  assert.equal(fb!.via, 'postgres');
  assert.equal(totalLeads(fb!.counts), 4);
  assert.equal(await loadLeads({}, resp([]), async () => { throw new Error('no db'); }), null);
});

test('mergeCounts sums duplicates and sorts biggest first', () => {
  assert.deepEqual(mergeCounts([{ source: 'a', count: 1 }, { source: 'b', count: 3 }, { source: 'a', count: 1 }]), [{ source: 'b', count: 3 }, { source: 'a', count: 2 }]);
});
