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
  'youtube/6TmlJMV61zk': { label: 'Summer' },
  'instagram/17898371274396827': { label: 'Summer' },
  'youtube/eld4pMGKvWA': { videoNo: 45, hypothesis: 'H17' },
  'instagram/18183786739433061': { videoNo: 45, hypothesis: 'H17' },
  'youtube/bxjdaCYwU-4': { videoNo: 46, hypothesis: 'H17' },
  'instagram/18180521692429522': { videoNo: 46, hypothesis: 'H17' },
  'youtube/SnhmacnSEa0': { videoNo: 47, hypothesis: 'H18' },
  'instagram/17911655538501903': { videoNo: 47, hypothesis: 'H18' },
  'youtube/JFBmxPIN5po': { videoNo: 48, hypothesis: 'H19' },
  'instagram/18097510811450908': { videoNo: 48, hypothesis: 'H19' },
  'youtube/wklcc78mtG8': { videoNo: 49, hypothesis: 'H20' },
  'instagram/18081565172537032': { videoNo: 49, hypothesis: 'H20' },
  'youtube/9ZjcVKBiRLo': { label: 'Pentatonic box slideshow' },
  'instagram/18638367571047056': { label: 'Pentatonic box slideshow' },
  'instagram/17909184054330915': { label: 'Pentatonic box carousel' },
};

export function applyLabels(posts: PostRow[], labels: Record<string, PostLabel> = POST_LABELS): PostRow[] {
  return posts.map((p) => {
    const l = labels[`${p.platform}/${p.externalId}`];
    if (!l) return p;
    return { ...p, videoNo: l.videoNo ?? p.videoNo, hypothesis: l.hypothesis ?? null, label: l.label ?? null };
  });
}
