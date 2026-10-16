// YouTube upload: OAuth refresh -> start a resumable upload session -> one PUT with the bytes.
// Always private: videos uploaded by a Google Cloud project that has not passed Google's audit are
// forced to private anyway, so asking for anything else would only hide that behind a surprise.
import { fetchChecked, getJson } from '../social/http.js';
import { PublishError } from './types.js';

const UPLOAD = 'https://www.googleapis.com/upload/youtube/v3/videos';

export interface YoutubeContext {
  fetchFn: typeof fetch;
  env: Record<string, string | undefined>;
}

export interface YoutubeUpload {
  bytes: Uint8Array;
  title: string;
  description: string;
  tags: string[];
  /** 10 = Music, 27 = Education. */
  categoryId?: string;
}

export interface YoutubeResult {
  id: string;
  url: string;
  studioUrl: string;
}

async function accessToken(ctx: YoutubeContext): Promise<string> {
  const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_UPLOAD_REFRESH_TOKEN } = ctx.env;
  if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_UPLOAD_REFRESH_TOKEN) {
    throw new PublishError(
      'YouTube upload is not set up: YT_CLIENT_ID, YT_CLIENT_SECRET and YT_UPLOAD_REFRESH_TOKEN are needed in server/.env. ' +
        'Get the token with: npm run yt:auth -- --upload (the analytics token cannot upload).',
    );
  }
  const res = await getJson<{ access_token: string }>(ctx.fetchFn, 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: YT_CLIENT_ID,
      client_secret: YT_CLIENT_SECRET,
      refresh_token: YT_UPLOAD_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  return res.access_token;
}

export async function uploadToYoutube(ctx: YoutubeContext, p: YoutubeUpload): Promise<YoutubeResult> {
  const token = await accessToken(ctx);

  const init = await fetchChecked(ctx.fetchFn, `${UPLOAD}?${new URLSearchParams({ uploadType: 'resumable', part: 'snippet,status' })}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=UTF-8',
      'x-upload-content-type': 'video/mp4',
      'x-upload-content-length': String(p.bytes.length),
    },
    body: JSON.stringify({
      snippet: { title: p.title, description: p.description, tags: p.tags, categoryId: p.categoryId ?? '10' },
      status: { privacyStatus: 'private', selfDeclaredMadeForKids: false },
    }),
  });
  const session = init.res.headers.get('location');
  if (!session) throw new PublishError('YouTube did not return an upload session address');

  const done = await fetchChecked(ctx.fetchFn, session, {
    method: 'PUT',
    headers: { 'content-type': 'video/mp4', 'content-length': String(p.bytes.length) },
    body: p.bytes as RequestInit['body'],
  });
  const id = (done.body as { id?: string } | null)?.id;
  if (!id) throw new PublishError('YouTube accepted the upload but returned no video id');
  return { id, url: `https://www.youtube.com/shorts/${id}`, studioUrl: `https://studio.youtube.com/video/${id}/edit` };
}
