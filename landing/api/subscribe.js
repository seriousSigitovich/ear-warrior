// POST /api/subscribe  { email }  -> inserts into the Supabase `signups` table.
// Zero dependencies: uses the global fetch of Vercel's Node runtime and Supabase's REST endpoint.
// Config via env vars on the Vercel project (Settings -> Environment Variables):
//   SUPABASE_URL       e.g. https://xxxxxxxx.supabase.co
//   SUPABASE_ANON_KEY  the project's anon (public) key — insert-only via RLS, see migration 0002.

const TABLE = 'signups';
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

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Misconfigured deploy: tell the client clearly rather than silently losing signups.
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }

  try {
    const r = await fetch(`${url}/rest/v1/${TABLE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        email,
        source: 'landing',
        user_agent: String(req.headers['user-agent'] || '').slice(0, 300),
      }),
    });

    if (r.ok) return res.status(200).json({ ok: true });
    // Unique-index violation (already subscribed) surfaces as 409 — that's a success for the user.
    if (r.status === 409) return res.status(200).json({ ok: true, already: true });

    const detail = await r.text();
    console.error('supabase insert failed', r.status, detail);
    return res.status(502).json({ ok: false, error: 'store_failed' });
  } catch (err) {
    console.error('subscribe error', err);
    return res.status(502).json({ ok: false, error: 'store_failed' });
  }
};
