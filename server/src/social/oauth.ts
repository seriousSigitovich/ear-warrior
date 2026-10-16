// Pure helpers for the one-time YouTube authorisation (see src/youtube-auth.ts).

export const YT_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
] as const;

/** Upload only — a separate consent so the analytics token can never post and the upload token can never read. */
export const YT_UPLOAD_SCOPES = ['https://www.googleapis.com/auth/youtube.upload'] as const;

/** `access_type=offline` + `prompt=consent` is what makes Google hand back a refresh token. */
export function buildAuthUrl(p: { clientId: string; redirectUri: string; state: string; scopes?: readonly string[] }): string {
  const q = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: 'code',
    scope: (p.scopes ?? YT_SCOPES).join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: p.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

/** Replace `KEY=...` in .env-style text, or append it when absent. Other lines are untouched. */
export function setEnvVar(content: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(content)) return content.replace(re, () => line);
  return `${content}${content.endsWith('\n') || content === '' ? '' : '\n'}${line}\n`;
}
