// POST /api/phone { email, phone } -> records which phone a fresh signup has ("android" | "iphone").
// Android answers are emailed to the owner, who adds the address to the Play closed test by hand
// (no self-serve link on the page since 2026-11-06). Same SMTP env vars as subscribe.js.

const { setPhone } = require('./_store');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONES = ['android', 'iphone'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body || {};

  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 320 || !PHONES.includes(phone)) {
    return res.status(400).json({ ok: false, error: 'invalid' });
  }

  let known = null;
  try {
    known = await setPhone(email, phone);
  } catch (err) {
    console.error('store error', err);
  }
  // Not on the list: answer ok, but don't mail the owner about an address nobody signed up with.
  if (known === false) return res.status(200).json({ ok: true });

  if (phone === 'android' && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const nodemailer = require('nodemailer');
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transport.sendMail({
        from: `Ear Warrior <${process.env.SMTP_USER}>`,
        to: process.env.NOTIFY_TO || process.env.SMTP_USER,
        replyTo: email,
        subject: `Android beta: ${email}`,
        text: `${email} answered "Android" after signing up.\n\nAdd to Play Console -> Alpha -> Testers -> Beta waitlist, then send the invite.\nua: ${String(req.headers['user-agent'] || '').slice(0, 200)}`,
      });
    } catch (err) {
      console.error('smtp error', err);
      return res.status(502).json({ ok: false, error: 'notify_failed' });
    }
  }

  return res.status(200).json({ ok: true });
};
