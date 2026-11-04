// Funnel steps, leave spots and the rendered page, from hand-built device runs (no database).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFunnel, furthestStep, leaveSpots, placeLabel, renderFunnelPage, type DeviceRun } from './page.js';

const run = (over: Partial<DeviceRun> = {}): DeviceRun => ({
  deviceId: 'dev_aaaaaaaaaa',
  email: null,
  firstAt: new Date('2026-11-03T10:00:00Z'),
  lastAt: new Date('2026-11-03T10:05:00Z'),
  days: 1,
  onboardingStep: 0,
  onboardingDone: false,
  onboardingSkipped: false,
  signinSeen: false,
  codeRequested: false,
  signedIn: false,
  signinErrors: [],
  practiceOpened: false,
  melodyPlayed: false,
  answerStarted: false,
  answers: 0,
  correct: 0,
  leftScreen: null,
  leftPhase: null,
  ...over,
});

const quitOnboarding = run({ onboardingStep: 2, leftScreen: 'onboarding' });
const signedInNoPlay = run({ onboardingStep: 3, onboardingDone: true, signinSeen: true, codeRequested: true, signedIn: true, leftScreen: 'home' });
const player = run({
  onboardingStep: 1,
  onboardingDone: true,
  onboardingSkipped: true,
  practiceOpened: true,
  melodyPlayed: true,
  answerStarted: true,
  answers: 4,
  correct: 1,
  days: 2,
  leftScreen: 'practice',
  leftPhase: 'awaitingInput',
});

test('counts every device at each step it reached', () => {
  const steps = buildFunnel([quitOnboarding, signedInNoPlay, player]);
  const count = (label: string) => steps.find((s) => s.label === label)!.count;
  assert.equal(count('Открыли приложение'), 3);
  assert.equal(count('Онбординг: экран 2'), 2);
  assert.equal(count('Закрыли онбординг'), 2);
  assert.equal(count('Вошли'), 1);
  assert.equal(count('Проверили ответ'), 1);
  assert.equal(count('Вернулись в другой день'), 1);
  assert.equal(steps.find((s) => s.label === 'Вошли')!.branch, true);
});

test('the furthest step ignores the optional sign-in branch', () => {
  assert.equal(furthestStep(quitOnboarding), 'Онбординг: экран 2');
  assert.equal(furthestStep(signedInNoPlay), 'Закрыли онбординг');
  assert.equal(furthestStep(player), 'Вернулись в другой день');
});

test('leave spots name the screen and the practice phase', () => {
  assert.equal(placeLabel('practice', 'awaitingInput'), 'Практика · отвечал');
  assert.equal(placeLabel(null, null), 'неизвестно');
  assert.deepEqual(leaveSpots([quitOnboarding, run({ leftScreen: 'onboarding' }), player]), [
    { place: 'Онбординг', count: 2 },
    { place: 'Практика · отвечал', count: 1 },
  ]);
});

test('the page escapes emails and renders an empty state', () => {
  const html = renderFunnelPage([run({ email: '<b>x@y.co</b>' })], new Date('2026-11-03T12:00:00Z'));
  assert.ok(html.includes('&lt;b&gt;x@y.co&lt;/b&gt;'));
  assert.ok(!html.includes('<b>x@y.co</b>'));
  assert.ok(renderFunnelPage([], new Date()).includes('Пока нет устройств'));
});
