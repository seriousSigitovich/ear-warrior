// One-time helper: `npm run yt:auth`.
// Opens Google's consent screen in your browser, catches the redirect on localhost, exchanges the
// code for a refresh token and writes it to .env as YT_REFRESH_TOKEN. The token is never printed.
// Needs YT_CLIENT_ID / YT_CLIENT_SECRET in .env and http://localhost:8765/callback as an
// authorised redirect URI of that OAuth client.
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { getJson } from './social/http.js';
import { buildAuthUrl, setEnvVar } from './social/oauth.js';

const PORT = 8765;
const REDIRECT = `http://localhost:${PORT}/callback`;
const clientId = process.env.YT_CLIENT_ID;
const clientSecret = process.env.YT_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Set YT_CLIENT_ID and YT_CLIENT_SECRET in server/.env first.');
  process.exit(1);
}

const state = randomBytes(16).toString('hex');
const url = buildAuthUrl({ clientId, redirectUri: REDIRECT, state });

const server = createServer(async (req, res) => {
  const u = new URL(req.url ?? '/', REDIRECT);
  if (u.pathname !== '/callback') {
    res.writeHead(404).end();
    return;
  }
  const fail = (code: number, msg: string) => {
    res.writeHead(code, { 'content-type': 'text/plain; charset=utf-8' }).end(msg);
    console.error(msg);
    server.close();
    process.exitCode = 1;
  };
  if (u.searchParams.get('state') !== state) return fail(400, 'State mismatch — start again.');
  const code = u.searchParams.get('code');
  if (!code) return fail(400, `Google returned an error: ${u.searchParams.get('error') ?? 'no code'}`);
  try {
    const tok = await getJson<{ refresh_token?: string }>(fetch, 'https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT,
        grant_type: 'authorization_code',
      }),
    });
    if (!tok.refresh_token) return fail(500, 'Google returned no refresh token. Revoke the app at myaccount.google.com/permissions and retry.');
    writeFileSync('.env', setEnvVar(readFileSync('.env', 'utf8'), 'YT_REFRESH_TOKEN', tok.refresh_token));
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end('Done. YT_REFRESH_TOKEN saved to server/.env — you can close this tab.');
    console.log('YT_REFRESH_TOKEN saved to .env');
    server.close();
  } catch (err) {
    fail(500, `Token exchange failed: ${(err as Error).message}`);
  }
});

// Loopback only: nothing else on the network can reach the callback.
server.listen(PORT, '127.0.0.1', () => {
  console.log('Opening Google consent. If nothing opens, visit:\n' + url + '\n');
  execFile('open', [url], () => {});
});
setTimeout(() => {
  console.error('Timed out after 5 minutes.');
  process.exit(1);
}, 5 * 60_000).unref();
