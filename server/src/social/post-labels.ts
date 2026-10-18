// Manual map: platform post → the experiment it belongs to (T028). Platforms' own titles and
// captions carry no challenge number ("Caption:", "(без названия)"), so a rule on titles cannot
// work; this table is the source of truth and is read at request time, so the collector's
// upserts never overwrite it. Key = `${platform}/${externalId}` (YouTube video id, Instagram media id).
// Add a line when a post is published (the id is in docs/published.json) — unlabelled posts still show.
import type { PostRow } from './summary.js';

export interface PostLabel {
  videoNo?: number;
  /** H-id from docs/experiments.md. */
  hypothesis?: string;
  /** Free text for posts that are not numbered challenge videos. */
  label?: string;
}

export const POST_LABELS: Record<string, PostLabel> = {
  'youtube/jYiyVGVp5TA': { videoNo: 44, hypothesis: 'H16' },
  'youtube/Ie7sjMsQHCc': { label: 'Turkish March' },
  'instagram/18120569552319586': { label: 'Turkish March' },
  'youtube/TcVx5ma1Z3I': { label: 'Spring' },
  'instagram/18106209968190139': { label: 'Spring' },
};

export function applyLabels(posts: PostRow[], labels: Record<string, PostLabel> = POST_LABELS): PostRow[] {
  return posts.map((p) => {
    const l = labels[`${p.platform}/${p.externalId}`];
    if (!l) return p;
    return { ...p, videoNo: l.videoNo ?? p.videoNo, hypothesis: l.hypothesis ?? null, label: l.label ?? null };
  });
}
