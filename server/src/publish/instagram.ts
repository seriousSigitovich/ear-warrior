// Instagram Reel via the Instagram API with Instagram Login. Verified live (2026-10-16): this API does NOT
// accept a resumable upload (every variant answers "The parameter video_url is required"), so Meta must be
// handed a public https address it can download from (see hosting.ts, which provides a temporary one):
//   1) create a REELS container with video_url -> {id}
//   2) poll the container until FINISHED (Meta has downloaded and processed the video)
//   3) media_publish (skipped in stage-only mode) -> media id -> permalink
import { getJson } from '../social/http.js';
import { PublishError } from './types.js';

const BASE = 'https://graph.instagram.com/v23.0';

export interface InstagramContext {
  fetchFn: typeof fetch;
  env: Record<string, string | undefined>;
  sleep?: (ms: number) => Promise<void>;
  pollMs?: number;
  maxWaitMs?: number;
}

export interface ReelUpload {
  /** Public https address Meta can download the video from (temporary). */
  videoUrl: string;
  caption: string;
  /** Public https address of the cover image (JPEG) shown for the Reel; omitted = Instagram picks a frame. */
  coverUrl?: string;
  /** false = stage only: upload and process, but do not publish. */
  publish: boolean;
}

export interface ReelResult {
  containerId: string;
  mediaId?: string;
  permalink?: string;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function publishReel(ctx: InstagramContext, p: ReelUpload): Promise<ReelResult> {
  const token = ctx.env.IG_PUBLISH_TOKEN;
  if (!token) {
    throw new PublishError(
      'Instagram publishing is not set up: IG_PUBLISH_TOKEN is missing in server/.env. It must be a token generated after the ' +
        '`instagram_business_content_publish` permission was added to the Meta app (the analytics token cannot publish).',
    );
  }
  const sleep = ctx.sleep ?? defaultSleep;
  const pollMs = ctx.pollMs ?? 4000;
  const maxWaitMs = ctx.maxWaitMs ?? 300_000;

  const created = await getJson<{ id: string }>(ctx.fetchFn, `${BASE}/me/media`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      media_type: 'REELS',
      video_url: p.videoUrl,
      share_to_feed: 'true',
      caption: p.caption,
      ...(p.coverUrl ? { cover_url: p.coverUrl } : {}),
      access_token: token,
    }),
  });
  if (!created.id) throw new PublishError('Instagram did not accept the Reel (no container id returned)');

  let waited = 0;
  for (;;) {
    const st = await getJson<{ status_code?: string; status?: string }>(
      ctx.fetchFn,
      `${BASE}/${created.id}?${new URLSearchParams({ fields: 'status_code,status', access_token: token })}`,
    );
    if (st.status_code === 'FINISHED') break;
    if (st.status_code === 'ERROR' || st.status_code === 'EXPIRED') {
      throw new PublishError(`Instagram could not process the video: ${st.status_code}${st.status ? ` — ${st.status}` : ''}`);
    }
    if (waited >= maxWaitMs) {
      throw new PublishError(`Instagram is still processing the video (container ${created.id}) after ${Math.round(waited / 1000)} s; nothing was published — try again later`);
    }
    await sleep(pollMs);
    waited += pollMs;
  }

  if (!p.publish) return { containerId: created.id };

  const pub = await getJson<{ id: string }>(ctx.fetchFn, `${BASE}/me/media_publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ creation_id: created.id, access_token: token }),
  });
  const info = await getJson<{ permalink?: string }>(
    ctx.fetchFn,
    `${BASE}/${pub.id}?${new URLSearchParams({ fields: 'permalink', access_token: token })}`,
  );
  return { containerId: created.id, mediaId: pub.id, permalink: info.permalink };
}
