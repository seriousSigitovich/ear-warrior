// Delivery of the one-time code. An interface so the routes can be tested without SMTP (R8).
export interface Mailer {
  sendCode(to: string, code: string): Promise<void>;
}

export function renderCodeMail(code: string): { subject: string; text: string } {
  return {
    subject: `Your Ear Warrior code: ${code}`,
    text: [
      `Your Ear Warrior sign-in code is ${code}.`,
      'It works for 10 minutes and only once.',
      '',
      "If you didn't ask for it, just ignore this email — nothing happens until the code is entered.",
    ].join('\n'),
  };
}

type Env = Record<string, string | undefined>;

/** SMTP over nodemailer (the beta uses an existing mailbox). Loaded lazily so tests never touch it. */
function createSmtpMailer(env: Env): Mailer {
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASS;
  if (!user || !pass) throw new Error('SMTP_USER and SMTP_PASS are required to send sign-in codes');
  return {
    async sendCode(to, code) {
      const nodemailer = await import('nodemailer');
      const transport = nodemailer.createTransport({
        host: env.SMTP_HOST ?? 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user, pass },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 12000,
      });
      const { subject, text } = renderCodeMail(code);
      await transport.sendMail({ from: env.MAIL_FROM ?? user, to, subject, text });
    },
  };
}

/** Local development only: prints the code instead of mailing it. */
export function createConsoleMailer(write: (line: string) => void = console.log): Mailer {
  return {
    async sendCode(to, code) {
      write(`[auth] sign-in code for ${to}: ${code}`);
    },
  };
}

export interface RecordingMailer extends Mailer {
  sent: { to: string; code: string }[];
  failNext: boolean;
}

export function createRecordingMailer(): RecordingMailer {
  const mailer: RecordingMailer = {
    sent: [],
    failNext: false,
    async sendCode(to, code) {
      if (mailer.failNext) {
        mailer.failNext = false;
        throw new Error('smtp down');
      }
      mailer.sent.push({ to, code });
    },
  };
  return mailer;
}

export function mailerFromEnv(env: Env = process.env): Mailer {
  if (env.MAIL_DRIVER === 'console') {
    if (env.VERCEL) throw new Error('MAIL_DRIVER=console is refused on Vercel: it would print codes into shared logs');
    return createConsoleMailer();
  }
  return createSmtpMailer(env);
}
