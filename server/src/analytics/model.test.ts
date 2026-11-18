// Merging devices into people, funnel steps, statuses — from hand-built facts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { account, device } from './fixtures.js';
import { buildFunnel, buildUsers, furthestStep, leaveSpots, signinLabel, statusOf, summarize } from './model.js';

const NOW = new Date('2026-11-18T12:00:00Z');

test('devices of one account become one person; a guest device stays its own row', () => {
  const users = buildUsers({
    devices: [
      device({ deviceId: 'd1', userId: 'u-1', answers: 2, correct: 1, attempts: 3, attemptsCorrect: 2, days: 2, lastAt: new Date('2026-11-10T00:00:00Z') }),
      device({ deviceId: 'd2', userId: 'u-1', answers: 1, correct: 1, attempts: 1, attemptsCorrect: 1, days: 4, lastAt: new Date('2026-11-12T00:00:00Z'), signedIn: true }),
      device({ deviceId: 'd3', userId: null }),
    ],
    accounts: [account({ xp: 120, phrasesPassed: 2 })],
    tunes: [
      { userId: 'u-1', tuneId: 'canon', checks: 2, passed: 1 },
      { userId: 'u-1', tuneId: 'sailor', checks: 5, passed: 2 },
    ],
  });
  assert.equal(users.length, 2);
  const [anna, guest] = users;
  assert.equal(anna.email, 'anna@x.co');
  assert.deepEqual(anna.deviceIds, ['d1', 'd2']);
  assert.equal(anna.answers, 3);
  assert.equal(anna.attempts, 4);
  assert.equal(anna.days, 4);
  assert.equal(anna.xp, 120);
  assert.equal(anna.signedIn, true);
  assert.deepEqual(anna.tunes.map((t) => t.tuneId), ['sailor', 'canon']);
  assert.equal(guest.email, null);
  assert.equal(guest.key, 'd:d3');
});

test('an account with no installs gets a row, an empty guest account does not', () => {
  const users = buildUsers({
    devices: [],
    accounts: [account(), account({ userId: 'u-2', email: null, anonymous: true })],
    tunes: [],
  });
  assert.deepEqual(users.map((u) => u.userId), ['u-1']);
  assert.equal(users[0].lastAt, null);
});

test('a device linked to an account the loader did not return is kept as a guest', () => {
  const users = buildUsers({ devices: [device({ deviceId: 'd9', userId: 'ghost' })], accounts: [], tunes: [] });
  assert.equal(users.length, 1);
  assert.equal(users[0].key, 'd:d9');
});

test('people are listed most recently seen first, attempts count as being seen', () => {
  const users = buildUsers({
    devices: [
      device({ deviceId: 'old', lastAt: new Date('2026-11-01T00:00:00Z') }),
      device({ deviceId: 'att', lastAt: new Date('2026-11-02T00:00:00Z'), lastAttemptAt: new Date('2026-11-17T00:00:00Z') }),
    ],
    accounts: [],
    tunes: [],
  });
  assert.deepEqual(users.map((u) => u.deviceIds[0]), ['att', 'old']);
});

const people = () =>
  buildUsers({
    devices: [
      device({ deviceId: 'quit', onboardingStep: 2, leftScreen: 'onboarding' }),
      device({ deviceId: 'signed', onboardingStep: 3, onboardingDone: true, signinSeen: true, codeRequested: true, signedIn: true, leftScreen: 'home' }),
      device({ deviceId: 'player', onboardingStep: 1, onboardingDone: true, practiceOpened: true, melodyPlayed: true, answerStarted: true, answers: 4, correct: 1, days: 2, leftScreen: 'practice', leftPhase: 'awaitingInput' }),
      device({ deviceId: 'old', tracked: false }),
    ],
    accounts: [],
    tunes: [],
  });

test('the funnel counts only people whose build reports screens, and the sign-in branch is separate', () => {
  const f = Object.fromEntries(buildFunnel(people()).map((s) => [s.label, s.count]));
  assert.equal(f['Открыли приложение'], 3);
  assert.equal(f['Онбординг: экран 3'], 1);
  assert.equal(f['Закрыли онбординг'], 2);
  assert.equal(f['Вошли'], 1);
  assert.equal(f['Проверили ответ'], 1);
  assert.equal(f['Вернулись в другой день'], 1);
});

test('a person is placed at the furthest main step, and a phrase passed outranks answers', () => {
  const byId = Object.fromEntries(people().map((u) => [u.deviceIds[0], u]));
  assert.equal(furthestStep(byId.quit), 'Онбординг: экран 2');
  assert.equal(furthestStep(byId.signed), 'Закрыли онбординг');
  assert.equal(furthestStep(byId.player), 'Вернулись в другой день');
  const passer = buildUsers({ devices: [device({ userId: 'u-1', answers: 5 })], accounts: [account({ phrasesPassed: 1 })], tunes: [] })[0];
  assert.equal(furthestStep(passer), 'Прошли фразу');
});

test('sign-in label and leave spots', () => {
  const byId = Object.fromEntries(people().map((u) => [u.deviceIds[0], u]));
  assert.equal(signinLabel(byId.signed), 'вошёл');
  assert.equal(signinLabel(byId.quit), '—');
  assert.deepEqual(leaveSpots(people()).map((s) => s.place).sort(), ['Главная', 'Онбординг', 'Практика · отвечал']);
});

test('status: fresh is active, silence after practice cools, silence before practice means left', () => {
  const at = (d: Date, over = {}) => buildUsers({ devices: [device({ lastAt: d, ...over })], accounts: [], tunes: [] })[0];
  assert.equal(statusOf(at(new Date('2026-11-18T08:00:00Z')), NOW), 'active');
  assert.equal(statusOf(at(new Date('2026-11-16T12:00:00Z'), { practiceOpened: true }), NOW), 'active');
  assert.equal(statusOf(at(new Date('2026-11-10T12:00:00Z'), { practiceOpened: true }), NOW), 'cooled');
  assert.equal(statusOf(at(new Date('2026-11-10T12:00:00Z')), NOW), 'left');
  assert.equal(statusOf(buildUsers({ devices: [], accounts: [account()], tunes: [] })[0], NOW), 'none');
});

test('summary totals', () => {
  const s = summarize(
    buildUsers({
      devices: [
        device({ deviceId: 'a', userId: 'u-1', lastAt: new Date('2026-11-17T00:00:00Z'), answers: 1, days: 2 }),
        device({ deviceId: 'b', lastAt: new Date('2026-10-01T00:00:00Z') }),
      ],
      accounts: [account()],
      tunes: [],
    }),
    NOW,
  );
  assert.deepEqual(s, { total: 2, withEmail: 1, activeWeek: 1, reachedAnswer: 1, returned: 1 });
});
