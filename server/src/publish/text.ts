// Assembles the per-platform text (limits enforced here, before anything is uploaded).
import { PublishError, type PlatformName } from './types.js';

export const YT_TITLE_MAX = 100;
export const YT_DESCRIPTION_MAX = 5000;
export const YT_HASHTAGS_MAX = 15; // YouTube ignores every hashtag of a video that has more
export const YT_TAGS_CHARS_MAX = 500;
export const IG_CAPTION_MAX = 2200;
export const IG_HASHTAGS_MAX = 30;
export const SITE = 'https://earwarrior.app/';

/** "#guitar #EarTraining, play-by-ear" -> ['guitar','EarTraining','playbyear'] (no #, no junk, case-insensitive de-dup). */
export function normalizeTags(input?: string | string[]): string[] {
  const raw = Array.isArray(input) ? input.join(' ') : (input ?? '');
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of raw.split(/[\s,]+/)) {
    const tag = piece.replace(/[^\p{L}\p{N}_]/gu, '');
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      out.push(tag);
    }
  }
  return out;
}

/** Same source tags the landing page parses ("youtube:ear31:desc"). */
export function utmUrl(p: { platform: PlatformName; videoNo: number | null; content?: string }): string {
  const q = new URLSearchParams({ utm_source: p.platform });
  if (p.videoNo !== null) q.set('utm_campaign', `ear${String(p.videoNo).padStart(2, '0')}`);
  q.set('utm_content', p.content ?? 'desc');
  return `${SITE}?${q}`;
}

export function buildYoutube(p: { title: string; description: string; tags: string[]; videoNo: number | null }) {
  const title = p.title.trim();
  if (!title) throw new PublishError('YouTube title is empty');
  if (title.length > YT_TITLE_MAX) throw new PublishError(`YouTube title is ${title.length} characters; the limit is ${YT_TITLE_MAX}`);

  const tags = normalizeTags(['Shorts', ...p.tags]).filter((t) => t.toLowerCase() !== 'shorts');
  const hashtags = ['Shorts', ...tags];
  if (hashtags.length > YT_HASHTAGS_MAX) {
    throw new PublishError(`YouTube ignores all hashtags when a video has more than ${YT_HASHTAGS_MAX}; this one has ${hashtags.length}`);
  }
  if (tags.join(',').length > YT_TAGS_CHARS_MAX) throw new PublishError(`YouTube tags are over ${YT_TAGS_CHARS_MAX} characters in total`);

  const description = `${p.description.trim()}\n\nJoin the waitlist: ${utmUrl({ platform: 'youtube', videoNo: p.videoNo })}\n\n${hashtags.map((t) => `#${t}`).join(' ')}`;
  if (description.length > YT_DESCRIPTION_MAX) {
    throw new PublishError(`YouTube description is ${description.length} characters; the limit is ${YT_DESCRIPTION_MAX}`);
  }
  return { title, description, tags };
}

/** Instagram captions carry no link (it is not clickable); the link lives in the bio. */
export function buildInstagram(p: { caption: string; tags: string[] }) {
  const tags = normalizeTags(p.tags);
  if (tags.length > IG_HASHTAGS_MAX) throw new PublishError(`Instagram allows at most ${IG_HASHTAGS_MAX} hashtags; got ${tags.length}`);
  const body = p.caption.trim();
  const caption = tags.length ? `${body}${body ? '\n\n' : ''}${tags.map((t) => `#${t}`).join(' ')}` : body;
  if (!caption) throw new PublishError('Instagram caption is empty');
  if (caption.length > IG_CAPTION_MAX) throw new PublishError(`Instagram caption is ${caption.length} characters; the limit is ${IG_CAPTION_MAX}`);
  return { caption };
}
