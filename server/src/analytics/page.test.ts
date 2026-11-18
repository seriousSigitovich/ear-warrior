// The rendered analytics page: totals, filters, escaping, sorting, from hand-built people (no database).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { account, device } from './fixtures.js';
import { buildUsers } from './model.js';
import { DEFAULT_VIEW, parseView, renderAnalyticsPage } from './page.js';

const NOW = new Date('2026-11-18T12:00:00Z');
const users = () =>
  buildUsers({
    devices: [
      device({ deviceId: 'dev_anna', userId: 'u-1', appVersion: '0.1.0', firstAt: new Date('2026-11-15T10:00:00Z'), practiceOpened: true, melodyPlayed: true, answers: 4, correct: 3, attempts: 4, attemptsCorrect: 3, days: 3, lastAt: new Date('2026-11-18T10:00:00Z'), signedIn: true }),
      device({ deviceId: 'dev_guest00', appVersion: '0.0.9', onboardingStep: 2, leftScreen: 'onboarding', lastAt: new Date('2026-11-05T10:00:00Z'), firstAt: new Date('2026-11-05T09:00:00Z') }),
    ],
    accounts: [account({ xp: 1240, phrasesPassed: 2, phraseChecks: 5 })],
    tunes: [{ userId: 'u-1', tuneId: 'greensleeves', checks: 5, passed: 2 }],
  });

test('renders totals, funnel, a row per person with their card', () => {
  const html = renderAnalyticsPage(users(), NOW);
  assert.match(html, /<title>Аналитика/);
  assert.match(html, /Пользователей<\/span><b>2<\/b><span class="muted small">1 с почтой/);
  assert.match(html, /Воронка первого запуска · 2 чел\./);
  assert.match(html, /anna@x\.co/);
  assert.match(html, /Гость dev_gues/);
  assert.match(html, /greensleeves \(5\)/);
  assert.match(html, /XP: 1240/);
  assert.equal((html.match(/<tr class="u">/g) ?? []).length, 2);
  assert.equal((html.match(/<tr class="more" hidden>/g) ?? []).length, 2);
});

test('emails and typed text are escaped', () => {
  const evil = buildUsers({ devices: [device({ userId: 'u-1' })], accounts: [account({ email: '<img src=x onerror=alert(1)>@x.co' })], tunes: [] });
  const html = renderAnalyticsPage(evil, NOW);
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img src=x'));
  const searched = renderAnalyticsPage(evil, NOW, { ...DEFAULT_VIEW, q: '"><script>' });
  assert.ok(!searched.includes('"><script>'));
  assert.ok(searched.includes('&quot;&gt;&lt;script&gt;'));
});

test('filters narrow the table, the cohort narrows the totals too', () => {
  const guests = renderAnalyticsPage(users(), NOW, { ...DEFAULT_VIEW, who: 'guests' });
  assert.ok(!guests.includes('anna@x.co'));
  assert.match(guests, /Пользователи · 1 из 2/);
  const v = renderAnalyticsPage(users(), NOW, { ...DEFAULT_VIEW, version: '0.0.9' });
  assert.match(v, /Пользователей<\/span><b>1<\/b>/);
  const week = renderAnalyticsPage(users(), NOW, { ...DEFAULT_VIEW, period: '7d' });
  assert.match(week, /Пользователей<\/span><b>1<\/b>/);
  const q = renderAnalyticsPage(users(), NOW, { ...DEFAULT_VIEW, q: 'ANNA' });
  assert.match(q, /Пользователи · 1 из 2/);
});

test('sorting by XP puts the richest first; the empty state shows with no people', () => {
  const html = renderAnalyticsPage(users(), NOW, { ...DEFAULT_VIEW, sort: 'xp' });
  assert.ok(html.indexOf('anna@x.co') < html.indexOf('Гость dev_gues'));
  assert.match(renderAnalyticsPage([], NOW), /Пока нет данных/);
});

test('parseView accepts only known values', () => {
  assert.deepEqual(parseView({ sort: 'drop table', who: 'x', period: 'y', version: 5, q: '  hi ' }), { ...DEFAULT_VIEW, q: 'hi' });
  assert.deepEqual(parseView({ sort: 'xp', who: 'cooled', period: '7d', version: '0.1.0' }), { sort: 'xp', who: 'cooled', period: '7d', version: '0.1.0', q: '' });
});
