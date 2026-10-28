// Instagram Reel and photo carousel via the Instagram API with Instagram Login. Verified live (2026-10-16): this API does NOT
// accept a resumable upload (every variant answers "The parameter video_url is required"), so Meta must be
// handed a public https address it can download from (see hosting.ts, which provides a temporary one):
//   1) create a REELS container with video_url -> {id}
//   2) poll the container until FINISHED (Meta has downloaded and processed the video)
//   3) media_publish (skipped in stage-only mode) -> media id -> permalink
// A carousel (2–10 JPEG images, see images.ts) is the same dance with one extra level: a container per image
// (is_carousel_item), each polled to FINISHED, then a CAROUSEL container listing the children, polled, published.
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

function requireToken(ctx: InstagramContext): string {
  const token = ctx.env.IG_PUBLISH_TOKEN;
  if (!token) {
    throw new PublishError(
      'Instagram publishing is not set up: IG_PUBLISH_TOKEN is missing in server/.env. It must be a token generated after the ' +
        '`instagram_business_content_publish` permission was added to the Meta app (the analytics token cannot publish).',
    );
  }
  return token;
}

const form = (fields: Record<string, string>) => ({
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(fields),
});

/** Polls a container until Meta reports FINISHED; ERROR/EXPIRED or a timeout stop the run before anything is published. */
async function waitFinished(ctx: InstagramContext, token: string, id: string, what: 'video' | 'image' | 'carousel'): Promise<void> {
  const sleep = ctx.sleep ?? defaultSleep;
  const pollMs = ctx.pollMs ?? 4000;
  const maxWaitMs = ctx.maxWaitMs ?? 300_000;
  let waited = 0;
  for (;;) {
    const st = await getJson<{ status_code?: string; status?: string }>(
      ctx.fetchFn,
      `${BASE}/${id}?${new URLSearchParams({ fields: 'status_code,status', access_token: token })}`,
    );
    if (st.status_code === 'FINISHED') return;
    if (st.status_code === 'ERROR' || st.status_code === 'EXPIRED') {
      throw new PublishError(`Instagram could not process the ${what}: ${st.status_code}${st.status ? ` — ${st.status}` : ''}`);
    }
    if (waited >= maxWaitMs) {
      throw new PublishError(`Instagram is still processing the ${what} (container ${id}) after ${Math.round(waited / 1000)} s; nothing was published — try again later`);
    }
    await sleep(pollMs);
    waited += pollMs;
  }
}

/** media_publish for a finished container, then the permalink. */
async function publishContainer(ctx: InstagramContext, token: string, containerId: string): Promise<ReelResult> {
  const pub = await getJson<{ id: string }>(ctx.fetchFn, `${BASE}/me/media_publish`, form({ creation_id: containerId, access_token: token }));
  const info = await getJson<{ permalink?: string }>(ctx.fetchFn, `${BASE}/${pub.id}?${new URLSearchParams({ fields: 'permalink', access_token: token })}`);
  return { containerId, mediaId: pub.id, permalink: info.permalink };
}

export async function publishReel(ctx: InstagramContext, p: ReelUpload): Promise<ReelResult> {
  const token = requireToken(ctx);
  const created = await getJson<{ id: string }>(
    ctx.fetchFn,
    `${BASE}/me/media`,
    form({
      media_type: 'REELS',
      video_url: p.videoUrl,
      share_to_feed: 'true',
      caption: p.caption,
      ...(p.coverUrl ? { cover_url: p.coverUrl } : {}),
      access_token: token,
    }),
  );
  if (!created.id) throw new PublishError('Instagram did not accept the Reel (no container id returned)');
  await waitFinished(ctx, token, created.id, 'video');
  if (!p.publish) return { containerId: created.id };
  return publishContainer(ctx, token, created.id);
}

export interface CarouselUpload {
  /** Public https addresses of the JPEG slides, in order (temporary, see hosting.ts). */
  imageUrls: string[];
  caption: string;
  /** false = stage only: build and process the carousel container, do not publish. */
  publish: boolean;
}

export const CAROUSEL_MIN = 2;
export const CAROUSEL_MAX = 10;

export async function publishCarousel(ctx: InstagramContext, p: CarouselUpload): Promise<ReelResult> {
  const token = requireToken(ctx);
  if (p.imageUrls.length < CAROUSEL_MIN || p.imageUrls.length > CAROUSEL_MAX) {
    throw new PublishError(`An Instagram carousel takes ${CAROUSEL_MIN}–${CAROUSEL_MAX} images; got ${p.imageUrls.length}`);
  }
  const children: string[] = [];
  for (const [i, url] of p.imageUrls.entries()) {
    const child = await getJson<{ id: string }>(ctx.fetchFn, `${BASE}/me/media`, form({ image_url: url, is_carousel_item: 'true', access_token: token }));
    if (!child.id) throw new PublishError(`Instagram did not accept slide ${i + 1} (no container id returned)`);
    await waitFinished(ctx, token, child.id, 'image');
    children.push(child.id);
  }
  const created = await getJson<{ id: string }>(
    ctx.fetchFn,
    `${BASE}/me/media`,
    form({ media_type: 'CAROUSEL', children: children.join(','), caption: p.caption, access_token: token }),
  );
  if (!created.id) throw new PublishError('Instagram did not accept the carousel (no container id returned)');
  await waitFinished(ctx, token, created.id, 'carousel');
  if (!p.publish) return { containerId: created.id };
  return publishContainer(ctx, token, created.id);
}
