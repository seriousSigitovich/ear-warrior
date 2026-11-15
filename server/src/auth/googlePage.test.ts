// Spec 022 R4: the return page the browser shows after Google; a visible button always works.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { returnPage } from './googlePage.js';

test('success: a button to the app link carrying the ticket, and an automatic attempt', () => {
  const html = returnPage({ ticket: 'abc_-123' });
  assert.match(html, /<a [^>]*href="earwarrior:\/\/sign-in\?ticket=abc_-123"/);
  assert.match(html, /location\.href\s*=\s*"earwarrior:\/\/sign-in\?ticket=abc_-123"/);
  assert.match(html, /Return to Ear Warrior/);
});

test('each error has plain copy and a link back with the code', () => {
  for (const error of ['cancelled', 'unverified_email', 'expired', 'google_failed', 'google_disabled'] as const) {
    const html = returnPage({ error });
    assert.match(html, new RegExp(`href="earwarrior://sign-in\\?error=${error}"`));
    assert.doesNotMatch(html, /ticket=/);
    assert.match(html, /Back to Ear Warrior/);
  }
  assert.match(returnPage({ error: 'unverified_email' }), /hasn(&#39;|')t verified/);
});

test('values are encoded and escaped, never injected raw', () => {
  const html = returnPage({ ticket: '"><script>alert(1)</script>' });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /ticket=%22%3E%3Cscript%3E/);
});
