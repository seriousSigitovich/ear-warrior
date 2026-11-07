// POST /api/reserve { email, source } -> holds the course's founding price for this email.
// No payment is taken: on launch day the owner emails everyone on the list a payment link.
// Same config as /api/subscribe:
//   KV_REST_API_URL, KV_REST_API_TOKEN   reservations live in the course_reservations sorted set (see _store.js)
//   SMTP_USER, SMTP_PASS (+ SMTP_HOST, NOTIFY_TO)   each new reservation is emailed to the owner
// At least one of the two must be set, or the endpoint answers 503 rather than losing reservations.

const { addReservation } = require('./_store');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  // Honeypot: bots fill hidden fields. Pretend success and drop silently.
  if (body.company) return res.status(200).json({ ok: true });

  const email = String(body.email || '')
    .trim()
    .toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 320) {
    return res.status(400).json({ ok: false, error: 'invalid_email' });
  }

  const source =
    String(body.source || '')
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]/g, '')
      .slice(0, 60) || 'course';

  let stored = null;
  try {
    stored = await addReservation(email, source);
  } catch (err) {
    console.error('store error', err);
  }

  if (stored && !stored.isNew) return res.status(200).json({ ok: true, duplicate: true });

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
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
        subject: `Course reservation: ${email}`,
        text: `${email}${stored ? `  (#${stored.count})` : ''}\n\nsource: ${source}\nua: ${String(req.headers['user-agent'] || '').slice(0, 200)}`,
      });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('smtp error', err);
      if (stored) return res.status(200).json({ ok: true });
      return res.status(502).json({ ok: false, error: 'store_failed' });
    }
  }

  if (stored) return res.status(200).json({ ok: true });
  return res.status(503).json({ ok: false, error: 'not_configured' });
};
