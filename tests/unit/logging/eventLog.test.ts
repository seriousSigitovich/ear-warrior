import {
  AppEventClient,
  AppEventPayload,
  buildEventPayload,
  createAppEventOutbox,
  defaultAppEventClient,
  screenFromPath,
} from '../../../src/services/logging/eventLog';

const at = new Date('2026-10-27T10:00:00.000Z');
const payload = (name: AppEventPayload['name'] = 'app_open') =>
  buildEventPayload(name, 'dev_x', '0.1.0', at, {});

function flaky(failures: number): AppEventClient & { sent: AppEventPayload[] } {
  let left = failures;
  const sent: AppEventPayload[] = [];
  return {
    sent,
    async insert(row) {
      if (left > 0) {
        left--;
        throw new Error('offline');
      }
      sent.push(row);
    },
  };
}

describe('app event payload', () => {
  test('stamps the client clock and carries props', () => {
    expect(buildEventPayload('session_end', 'dev_x', '0.1.0', at, { attempt_count: 3 })).toEqual({
      device_id: 'dev_x',
      app_version: '0.1.0',
      name: 'session_end',
      occurred_at: '2026-10-27T10:00:00.000Z',
      props: { attempt_count: 3 },
    });
  });
});

describe('app event outbox', () => {
  test('sends an event straight through', async () => {
    const client = flaky(0);
    const box = createAppEventOutbox(client);
    await box.log(payload());
    expect(client.sent).toHaveLength(1);
    expect(box.pending()).toBe(0);
  });

  test('keeps an event offline and never throws', async () => {
    const box = createAppEventOutbox(flaky(1));
    await expect(box.log(payload())).resolves.toBeUndefined();
    expect(box.pending()).toBe(1);
  });

  test('the next log retries what was left behind, in order', async () => {
    const client = flaky(1);
    const box = createAppEventOutbox(client);
    await box.log(payload('app_open'));
    await box.log(payload('session_start'));
    expect(client.sent.map((e) => e.name)).toEqual(['app_open', 'session_start']);
    expect(box.pending()).toBe(0);
  });
});

describe('screen names', () => {
  test('maps expo-router paths to funnel names', () => {
    expect(screenFromPath('/')).toBe('home');
    expect(screenFromPath('/sign-in')).toBe('sign_in');
    expect(screenFromPath('/practice')).toBe('practice');
  });
});

describe('http client', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });
  const answer = (status: number) => {
    global.fetch = jest.fn(async () => ({ ok: status < 400, status }) as Response);
  };

  test('drops an event the server rejects, so it cannot block the queue', async () => {
    answer(400);
    const box = createAppEventOutbox(defaultAppEventClient('https://api.example')!);
    await box.log(payload('screen_view'));
    expect(box.pending()).toBe(0);
  });

  test('keeps an event when the server is down', async () => {
    answer(503);
    const box = createAppEventOutbox(defaultAppEventClient('https://api.example')!);
    await box.log(payload());
    expect(box.pending()).toBe(1);
  });
});
