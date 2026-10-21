import { isPlausibleEmail, normalizeEmail } from '../../../src/lib/email';

// Same vectors as server/src/auth/email.test.ts: the screen must reject exactly what the server rejects.
describe('email rules shared with the server', () => {
  test('normalizeEmail trims and lower-cases', () => {
    expect(normalizeEmail('  Name@Example.COM ')).toBe('name@example.com');
  });

  test('accepts ordinary addresses', () => {
    for (const ok of ['a@b.co', 'name+tag@example.com', 'first.last@sub.example.org']) {
      expect(isPlausibleEmail(ok)).toBe(true);
    }
  });

  test('rejects garbage', () => {
    for (const bad of [
      '',
      'plain',
      '@x.com',
      'a@',
      'a@b',
      'a b@c.com',
      'a@@b.com',
      `${'x'.repeat(320)}@a.com`,
    ]) {
      expect(isPlausibleEmail(bad)).toBe(false);
    }
  });
});
