import { sentryUserFor } from '../../../src/services/observability/sentryUser';

describe('sentryUserFor', () => {
  it('attributes a signed-in user by email and device id', () => {
    expect(sentryUserFor({ status: 'signedIn', email: 'a@b.co' }, 'dev_1')).toEqual({
      id: 'dev_1',
      email: 'a@b.co',
    });
  });

  it('still reports the email when the device id is not read yet', () => {
    expect(sentryUserFor({ status: 'signedIn', email: 'a@b.co' }, null)).toEqual({
      id: undefined,
      email: 'a@b.co',
    });
  });

  it('attributes an anonymous user by device id only, with no email', () => {
    expect(sentryUserFor({ status: 'anonymous' }, 'dev_1')).toEqual({ id: 'dev_1' });
  });

  it('clears the user when anonymous and the device id is unknown', () => {
    expect(sentryUserFor({ status: 'anonymous' }, null)).toBeNull();
  });
});
