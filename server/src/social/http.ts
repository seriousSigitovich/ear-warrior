// Small fetch wrapper for the collectors: JSON in/out, and errors that are safe to store and show.
// Platform APIs take access tokens in the query string, so URLs are scrubbed before they can end
// up in an error message (which the dashboard displays and the run log persists).

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function scrubUrl(url: string): string {
  return url.replace(/([?&](?:access_token|client_secret|refresh_token|token)=)[^&]*/gi, '$1***');
}

/** Like getJson but also hands back the Response (headers) and the raw text; throws HttpError on non-2xx. */
export async function fetchChecked(
  fetchFn: typeof fetch,
  url: string,
  init?: RequestInit,
): Promise<{ res: Response; text: string; body: unknown }> {
  const res = await fetchFn(url, init);
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const apiMsg = extractApiMessage(body) ?? text.slice(0, 200);
    throw new HttpError(res.status, `${res.status} from ${scrubUrl(url).split('?')[0]}: ${apiMsg}`);
  }
  return { res, text, body };
}

export async function getJson<T>(fetchFn: typeof fetch, url: string, init?: RequestInit): Promise<T> {
  return (await fetchChecked(fetchFn, url, init)).body as T;
}

/** Google: {error:{message}}; Meta: {error:{message,code}}; OAuth: {error_description}. */
function extractApiMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { error?: unknown; error_description?: unknown };
  if (typeof b.error_description === 'string') return b.error_description;
  if (b.error && typeof b.error === 'object') {
    const m = (b.error as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  if (typeof b.error === 'string') return b.error;
  return null;
}
