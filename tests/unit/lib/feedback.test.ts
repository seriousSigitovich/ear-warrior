import { FEEDBACK_EMAIL, buildFeedbackUrl } from '../../../src/lib/feedback';

describe('buildFeedbackUrl', () => {
  const parse = (url: string) => {
    const [head, query] = url.split('?');
    const params = new URLSearchParams(query);
    return {
      to: head.replace('mailto:', ''),
      subject: params.get('subject'),
      body: params.get('body'),
    };
  };

  it('addresses the feedback inbox with a fixed subject', () => {
    const { to, subject } = parse(
      buildFeedbackUrl({ platform: 'android', osVersion: 34, deviceId: 'dev_abc' }),
    );
    expect(to).toBe(FEEDBACK_EMAIL);
    expect(subject).toBe('Ear Warrior feedback');
  });

  it('puts the platform and device id below a line the user writes above', () => {
    const { body } = parse(
      buildFeedbackUrl({ platform: 'android', osVersion: 34, deviceId: 'dev_abc' }),
    );
    expect(body!.startsWith('\n\n')).toBe(true);
    expect(body).toContain('Platform: android 34');
    expect(body).toContain('Device: dev_abc');
  });

  it('says unknown when the device id has not been read yet', () => {
    const { body } = parse(
      buildFeedbackUrl({ platform: 'ios', osVersion: '18.1', deviceId: null }),
    );
    expect(body).toContain('Device: unknown');
  });

  it('survives a round trip through URL encoding (newlines, dashes, spaces)', () => {
    const url = buildFeedbackUrl({ platform: 'android', osVersion: 34, deviceId: 'dev_abc' });
    expect(url).not.toMatch(/\s/);
  });
});
