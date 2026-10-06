// POST /api/subscribe { email } -> validates, then forwards the email.
// Zero dependencies: uses the global fetch of Vercel's Node runtime.
// Config via env vars on the Vercel project (Settings -> Environment Variables):
//   KV_REST_API_URL, KV_REST_API_TOKEN   founding-members counter store (see _store.js); runs alongside the sinks below
// Sinks, first one set wins:
//   SMTP_USER, SMTP_PASS  (+ optional SMTP_HOST, NOTIFY_TO)  each signup is emailed to NOTIFY_TO (default: SMTP_USER)
//   API_URL        e.g. https://api.earwarrior.app         (the Fastify server in /server)

const { CAP, addSignup } = require('./_store');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  // Vercel parses application/json into req.body; be defensive about strings/empties.
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

  // Where the signup came from (e.g. "tiktok:ode"); the page already sanitises it, repeat here
  // because the body is client-controlled. The backend column caps at 64 chars.
  const source =
    String(body.source || '')
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]/g, '')
      .slice(0, 60) || 'landing';

  // Founding-members counter: record the signup first so the position/total can be returned.
  // A store outage must not lose the signup, so on failure we fall through to the other sinks.
  let stored = null;
  try {
    stored = await addSignup(email);
  } catch (err) {
    console.error('store error', err);
  }
  const founding = stored ? { position: stored.position, count: stored.count, cap: CAP } : {};

  // Simplest path: email the signup to the owner over SMTP (e.g. Gmail + an app password).
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
        subject: `New signup: ${email}`,
        text: `${email}${stored ? `  (#${stored.position})` : ''}\n\nsource: ${source}\nua: ${String(req.headers['user-agent'] || '').slice(0, 200)}`,
      });
      return res.status(200).json({ ok: true, ...founding });
    } catch (err) {
      console.error('smtp error', err);
      // Already in the store: the signup is safe, don't make the visitor retry.
      if (stored) return res.status(200).json({ ok: true, ...founding });
      return res.status(502).json({ ok: false, error: 'store_failed' });
    }
  }

  const api = process.env.API_URL;
  if (!api && stored) return res.status(200).json({ ok: true, ...founding });
  if (!api) {
    // Misconfigured deploy: tell the client clearly rather than silently losing signups.
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }

  try {
    const r = await fetch(`${api.replace(/\/$/, '')}/api/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': String(req.headers['user-agent'] || '').slice(0, 300),
      },
      body: JSON.stringify({ email, source }),
    });

    if (r.ok) {
      // The backend dedups and returns ok for repeat submits too.
      return res.status(200).json({ ok: true, ...founding });
    }
    const detail = await r.text();
    console.error('backend subscribe failed', r.status, detail);
    return res.status(502).json({ ok: false, error: 'store_failed' });
  } catch (err) {
    console.error('subscribe error', err);
    return res.status(502).json({ ok: false, error: 'store_failed' });
  }
};
