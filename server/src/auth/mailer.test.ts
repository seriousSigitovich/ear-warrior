import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createConsoleMailer, createRecordingMailer, mailerFromEnv, renderCodeMail } from './mailer.js';

test('the mail carries the code, the lifetime and a do-not-act hint, and nothing else personal', () => {
  const m = renderCodeMail('123456');
  assert.match(m.subject, /123456/);
  assert.match(m.text, /123456/);
  assert.match(m.text, /10 minutes/);
  assert.match(m.text, /ignore this email/i);
});

test('the recording mailer remembers what it sent and can be told to fail', async () => {
  const mailer = createRecordingMailer();
  await mailer.sendCode('a@x.co', '123456');
  assert.deepEqual(mailer.sent, [{ to: 'a@x.co', code: '123456' }]);
  mailer.failNext = true;
  await assert.rejects(mailer.sendCode('a@x.co', '111111'));
  await mailer.sendCode('a@x.co', '222222'); // only the next one fails
  assert.equal(mailer.sent.length, 2);
});

test('the console mailer prints and is refused on Vercel', async () => {
  const lines: string[] = [];
  await createConsoleMailer((l) => lines.push(l)).sendCode('a@x.co', '123456');
  assert.match(lines.join('\n'), /123456/);
  assert.throws(() => mailerFromEnv({ MAIL_DRIVER: 'console', VERCEL: '1' }), /Vercel/);
  assert.doesNotThrow(() => mailerFromEnv({ MAIL_DRIVER: 'console' }));
});

test('the SMTP mailer needs credentials', () => {
  assert.throws(() => mailerFromEnv({}), /SMTP_USER/);
});
