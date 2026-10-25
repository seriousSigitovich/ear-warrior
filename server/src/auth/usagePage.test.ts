import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderUsersPage, type UsageReport } from './usagePage.js';

const NOW = new Date('2026-10-25T12:00:00Z');

const report = (over: Partial<UsageReport> = {}): UsageReport => ({
  accounts: [],
  anonymous: { devices: 0, attempts: 0, attempts7d: 0, correct: 0, lastAt: null },
  ...over,
});

test('lists each account with its numbers and the anonymous row', () => {
  const html = renderUsersPage(
    report({
      accounts: [
        { email: 'a@x.co', createdAt: new Date('2026-10-20T10:00:00Z'), devices: 2, attempts: 40, attempts7d: 12, correct: 30, lastAt: new Date('2026-10-25T11:00:00Z') },
      ],
      anonymous: { devices: 5, attempts: 100, attempts7d: 20, correct: 60, lastAt: new Date('2026-10-24T12:00:00Z') },
    }),
    NOW,
  );
  assert.match(html, /a@x\.co/);
  assert.match(html, /<td[^>]*>40<\/td>/);
  assert.match(html, /75\s?%/, 'correct share = 30/40');
  assert.match(html, /Без входа/);
  assert.match(html, /1 ч назад/);
});

test('an account that never practised shows dashes, not zeros or NaN', () => {
  const html = renderUsersPage(
    report({ accounts: [{ email: 'new@x.co', createdAt: new Date('2026-10-25T09:00:00Z'), devices: 1, attempts: 0, attempts7d: 0, correct: 0, lastAt: null }] }),
    NOW,
  );
  assert.doesNotMatch(html, /NaN/);
  assert.match(html, /new@x\.co/);
  assert.match(html, /—/);
});

test('emails are escaped (they are typed by strangers)', () => {
  const html = renderUsersPage(
    report({ accounts: [{ email: '"><script>alert(1)</script>@x.co', createdAt: NOW, devices: 1, attempts: 1, attempts7d: 1, correct: 1, lastAt: NOW }] }),
    NOW,
  );
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test('says so when there are no accounts yet', () => {
  assert.match(renderUsersPage(report(), NOW), /Аккаунтов пока нет/);
});

test('is not indexable and links back to the social page', () => {
  const html = renderUsersPage(report(), NOW);
  assert.match(html, /noindex/);
  assert.match(html, /href="\/admin\/social"/);
});
