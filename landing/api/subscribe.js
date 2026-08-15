// POST /api/subscribe { email } -> forwards to the Ear Warrior Node/Postgres backend.
// Zero dependencies: uses the global fetch of Vercel's Node runtime.
// Config via env var on the Vercel project (Settings -> Environment Variables):
//   API_URL  e.g. https://api.earwarrior.app   (the Fastify server in /server)

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

  const api = process.env.API_URL;
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
      body: JSON.stringify({ email, source: 'landing' }),
    });

    if (r.ok) {
      // The backend dedups and returns ok for repeat submits too.
      return res.status(200).json({ ok: true });
    }
    const detail = await r.text();
    console.error('backend subscribe failed', r.status, detail);
    return res.status(502).json({ ok: false, error: 'store_failed' });
  } catch (err) {
    console.error('subscribe error', err);
    return res.status(502).json({ ok: false, error: 'store_failed' });
  }
};
