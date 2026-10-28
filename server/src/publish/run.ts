// The publish command's logic, with every side effect injected so it can be tested:
//   plan first (always), send only with --confirm, one platform's failure never blocks the other.
import { basename, dirname, extname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { addEntry, findEntry, loadLedger, relativeFile } from './ledger.js';
import { publishCarousel, publishReel } from './instagram.js';
import { IG_IMAGE_MAX_BYTES, validateCarousel, type ImageProbe } from './images.js';
import type { TempHost } from './hosting.js';
import { buildInstagram, buildYoutube, normalizeTags } from './text.js';
import { PublishError, type PlatformName } from './types.js';
import { validateForPlatform, videoNoFromFile, type Probe } from './video.js';
import { uploadToYoutube } from './youtube.js';

export interface Deps {
  env: Record<string, string | undefined>;
  fetchFn: typeof fetch;
  probe: (file: string) => Promise<Probe>;
  readFile: (file: string) => Promise<Uint8Array>;
  /** Temporary public address for the file (Instagram only takes a video_url). */
  host: TempHost;
  ledgerPath: string;
  repoRoot: string;
  now: () => Date;
  sleep?: (ms: number) => Promise<void>;
  out: (line: string) => void;
  /** Carousel support (--images); absent = the command only publishes videos. */
  images?: {
    list: (spec: string) => Promise<string[]>;
    probe: (file: string) => Promise<ImageProbe>;
    /** The slide as JPEG bytes (Instagram takes JPEG only). */
    jpeg: (file: string) => Promise<Uint8Array>;
  };
}

const OPTIONS = {
  file: { type: 'string' },
  images: { type: 'string' },
  platforms: { type: 'string' }, // default: youtube,instagram for a video, instagram for a carousel
  title: { type: 'string' },
  description: { type: 'string' },
  caption: { type: 'string' },
  cover: { type: 'string' },
  tags: { type: 'string' },
  'video-no': { type: 'string' },
  category: { type: 'string' },
  confirm: { type: 'boolean', default: false },
  'no-publish': { type: 'boolean', default: false },
  force: { type: 'boolean', default: false },
  long: { type: 'boolean', default: false },
} as const;

const NAMES: Record<PlatformName, string> = { youtube: 'YouTube', instagram: 'Instagram' };
const indent = (text: string, pad: string) => text.split('\n').map((l) => (l ? pad + l : l)).join('\n');

interface Planned {
  platform: PlatformName;
  blocked: string[];
  // set when the text built without error
  youtube?: ReturnType<typeof buildYoutube>;
  instagram?: ReturnType<typeof buildInstagram>;
}

export async function runPublish(argv: string[], deps: Deps): Promise<number> {
  const { out } = deps;
  let values;
  try {
    values = parseArgs({ args: argv, options: OPTIONS, allowPositionals: false }).values;
  } catch (err) {
    out(`✗ ${(err as Error).message}`);
    return 2;
  }
  try {
    return await run(values, deps);
  } catch (err) {
    out(`✗ ${err instanceof PublishError ? err.message : (err as Error).message}`);
    return 2;
  }
}

async function run(values: ReturnType<typeof parseArgs<{ options: typeof OPTIONS }>>['values'], deps: Deps): Promise<number> {
  const { out } = deps;
  if (values.images) return runCarousel(values, deps);
  if (!values.file) {
    out('✗ --file is required, e.g. --file assets/video/challenge/out/H14_youtube-A/ear-challenge-31.mp4 (or --images <folder> for a carousel)');
    return 2;
  }
  const platformsArg = values.platforms ?? 'youtube,instagram';
  const platforms = platformsArg.split(',').map((s) => s.trim()).filter(Boolean) as PlatformName[];
  const unknown = platforms.filter((p) => p !== 'youtube' && p !== 'instagram');
  if (unknown.length || platforms.length === 0) {
    out(`✗ --platforms must be a comma list of youtube, instagram (got "${platformsArg}")`);
    return 2;
  }
  if (values.long && platforms.some((p) => p !== 'youtube')) {
    out('✗ --long is a regular (16:9) YouTube video; publish the vertical file to Instagram in a separate run (--platforms instagram)');
    return 2;
  }
  if (platforms.includes('youtube') && !values.title) {
    out('✗ --title is required for YouTube');
    return 2;
  }

  const abs = resolve(values.file);
  const rel = relativeFile(abs, deps.repoRoot);
  const probe = await deps.probe(abs);
  const videoNo = values['video-no'] ? Number(values['video-no']) : videoNoFromFile(abs);
  const tags = normalizeTags(values.tags);
  const coverAbs = values.cover ? resolve(values.cover) : undefined;
  const ledger = loadLedger(deps.ledgerPath);

  out(`Video: ${rel} (${probe.durationS.toFixed(1)} s, ${probe.width}x${probe.height}, ${probe.videoCodec}/${probe.audioCodec ?? 'no audio'}, ${(probe.sizeBytes / 1024 / 1024).toFixed(1)} MB)${videoNo !== null ? ` — experiment #${videoNo}` : ''}`);

  const planned: Planned[] = [];
  for (const platform of platforms) {
    const plan: Planned = { platform, blocked: validateForPlatform(probe, platform, { longForm: values.long }) };
    try {
      if (platform === 'youtube') {
        plan.youtube = buildYoutube({ title: values.title ?? '', description: values.description ?? '', tags, videoNo, short: !values.long });
      } else {
        plan.instagram = buildInstagram({ caption: values.caption ?? values.description ?? '', tags });
      }
    } catch (err) {
      plan.blocked.push((err as Error).message);
    }
    if (platform === 'instagram' && coverAbs && !/\.jpe?g$/i.test(coverAbs)) plan.blocked.push('--cover must be a JPEG (.jpg) — Instagram takes JPEG covers only');
    const prior = findEntry(ledger, rel, platform);
    if (prior && !values.force) plan.blocked.push(`already published: ${prior.url} (use --force to publish again)`);
    planned.push(plan);

    out(`── ${NAMES[platform]} (${platform === 'youtube' ? (values.long ? 'regular video, uploaded private' : 'Short, uploaded private') : values['no-publish'] ? 'Reel, stage only' : 'Reel'})`);
    if (plan.youtube) {
      out(`   title: ${plan.youtube.title}`);
      out(`   description:\n${indent(plan.youtube.description, '     ')}`);
      out(`   tags: ${plan.youtube.tags.join(', ') || '(none)'}`);
    }
    if (plan.instagram) out(`   caption:\n${indent(plan.instagram.caption, '     ')}`);
    if (platform === 'instagram' && coverAbs) out(`   cover: ${relativeFile(coverAbs, deps.repoRoot)}`);
    if (platform === 'youtube' && coverAbs) out('   (the cover is Instagram only — set a Shorts thumbnail in Studio)');
    for (const b of plan.blocked) out(`   ✗ ${b}`);
    if (plan.blocked.length === 0) out('   ✓ ready');
  }

  const eligible = planned.filter((p) => p.blocked.length === 0);

  if (!values.confirm) {
    out('Dry run — nothing was sent. Add --confirm to publish.');
    return eligible.length === 0 ? 1 : 0;
  }

  const bytes = eligible.length ? await deps.readFile(abs) : new Uint8Array();
  let failed = false;
  for (const plan of eligible) {
    try {
      if (plan.platform === 'youtube' && plan.youtube) {
        const r = await uploadToYoutube(
          { fetchFn: deps.fetchFn, env: deps.env },
          { bytes, title: plan.youtube.title, description: plan.youtube.description, tags: plan.youtube.tags, categoryId: values.category, short: !values.long },
        );
        addEntry(deps.ledgerPath, { file: rel, videoNo, platform: 'youtube', postId: r.id, url: r.url, visibility: 'private', title: plan.youtube.title, publishedAt: deps.now().toISOString() });
        out(`✓ YouTube: ${r.url} (uploaded PRIVATE — publish it in Studio: ${r.studioUrl})`);
      } else if (plan.instagram) {
        const publish = !values['no-publish'];
        // Meta downloads the video from a temporary public copy; take it down whatever happens.
        const hosted = await deps.host(bytes, rel.split('/').pop() ?? 'video.mp4');
        const cover = coverAbs ? await deps.host(await deps.readFile(coverAbs), coverAbs.split('/').pop() ?? 'cover.jpg', 'image/jpeg').catch(async (e) => { await hosted.remove().catch(() => {}); throw e; }) : undefined;
        let r;
        try {
          r = await publishReel({ fetchFn: deps.fetchFn, env: deps.env, sleep: deps.sleep }, { videoUrl: hosted.url, coverUrl: cover?.url, caption: plan.instagram.caption, publish });
        } finally {
          for (const h of [hosted, cover]) await h?.remove().catch(() => out('   (could not delete a temporary copy — remove it from the Blob store)'));
        }
        if (!publish || !r.mediaId) {
          out(`✓ Instagram: staged (not published) — container ${r.containerId} is uploaded and processed`);
        } else {
          addEntry(deps.ledgerPath, {
            file: rel,
            videoNo,
            platform: 'instagram',
            postId: r.mediaId,
            url: r.permalink ?? '',
            visibility: 'public',
            title: values.title ?? plan.instagram.caption.split('\n')[0]!.slice(0, 100),
            publishedAt: deps.now().toISOString(),
          });
          out(`✓ Instagram: ${r.permalink ?? `published (media ${r.mediaId})`}`);
        }
      }
    } catch (err) {
      failed = true;
      out(`✗ ${NAMES[plan.platform]}: ${(err as Error).message}`);
    }
  }
  if (eligible.length === 0) out('Nothing to publish.');
  return eligible.length === 0 || failed ? 1 : 0;
}

/** Instagram photo carousel from a folder (or list) of PNG/JPEG slides. Same rules as a video: plan first, send only with --confirm. */
async function runCarousel(values: ReturnType<typeof parseArgs<{ options: typeof OPTIONS }>>['values'], deps: Deps): Promise<number> {
  const { out } = deps;
  const api = deps.images;
  if (!api) throw new PublishError('carousel publishing is not available in this build');
  if (values.file) {
    out('✗ use either --file (a video) or --images (a carousel), not both');
    return 2;
  }
  const platforms = (values.platforms ?? 'instagram').split(',').map((s) => s.trim()).filter(Boolean);
  if (platforms.length !== 1 || platforms[0] !== 'instagram') {
    out('✗ a carousel is Instagram only; leave --platforms out or use --platforms instagram (YouTube has no photo carousels)');
    return 2;
  }
  if (values.long || values.cover) {
    out('✗ --long and --cover apply to videos, not to a carousel');
    return 2;
  }

  const files = await api.list(values.images ?? '');
  if (files.length === 0) throw new PublishError(`No PNG or JPEG images found in ${values.images}`);
  const dirs = new Set(files.map((f) => dirname(f)));
  if (dirs.size > 1) throw new PublishError('the slides must come from one folder (the folder is what the publish record remembers)');
  const rel = relativeFile([...dirs][0]!, deps.repoRoot);
  const probes = await Promise.all(files.map((f) => api.probe(f)));
  const videoNo = values['video-no'] ? Number(values['video-no']) : null;
  const ledger = loadLedger(deps.ledgerPath);

  const first = probes[0]!;
  out(`Carousel: ${rel} (${files.length} slides, ${first.width}x${first.height}${files.some((f) => !/\.jpe?g$/i.test(f)) ? ', converted to JPEG for Instagram' : ''})${videoNo !== null ? ` — experiment #${videoNo}` : ''}`);
  out(`   order: ${files.map((f) => basename(f)).join(', ')}`);

  const blocked = validateCarousel(probes);
  let caption = '';
  try {
    caption = buildInstagram({ caption: values.caption ?? values.description ?? '', tags: normalizeTags(values.tags) }).caption;
  } catch (err) {
    blocked.push((err as Error).message);
  }
  const prior = findEntry(ledger, rel, 'instagram');
  if (prior && !values.force) blocked.push(`already published: ${prior.url} (use --force to publish again)`);

  out(`── Instagram (${values['no-publish'] ? 'carousel, stage only' : 'carousel'})`);
  if (caption) out(`   caption:\n${indent(caption, '     ')}`);
  for (const b of blocked) out(`   ✗ ${b}`);
  if (blocked.length === 0) out('   ✓ ready');

  if (!values.confirm) {
    out('Dry run — nothing was sent. Add --confirm to publish.');
    return blocked.length === 0 ? 0 : 1;
  }
  if (blocked.length > 0) {
    out('Nothing to publish.');
    return 1;
  }

  const hosted: Awaited<ReturnType<Deps['host']>>[] = [];
  try {
    for (const f of files) {
      const bytes = await api.jpeg(f);
      if (bytes.length > IG_IMAGE_MAX_BYTES) throw new PublishError(`${basename(f)} is ${(bytes.length / 1024 / 1024).toFixed(1)} MB as JPEG; Instagram takes up to 8 MB per image`);
      hosted.push(await deps.host(bytes, `${basename(f, extname(f))}.jpg`, 'image/jpeg'));
    }
    const publish = !values['no-publish'];
    const r = await publishCarousel({ fetchFn: deps.fetchFn, env: deps.env, sleep: deps.sleep }, { imageUrls: hosted.map((h) => h.url), caption, publish });
    if (!publish || !r.mediaId) {
      out(`✓ Instagram: staged (not published) — carousel container ${r.containerId} is ready`);
    } else {
      addEntry(deps.ledgerPath, {
        file: rel,
        videoNo,
        platform: 'instagram',
        postId: r.mediaId,
        url: r.permalink ?? '',
        visibility: 'public',
        title: values.title ?? caption.split('\n')[0]!.slice(0, 100),
        publishedAt: deps.now().toISOString(),
      });
      out(`✓ Instagram: ${r.permalink ?? `published (media ${r.mediaId})`}`);
    }
    return 0;
  } catch (err) {
    out(`✗ Instagram: ${(err as Error).message}`);
    return 1;
  } finally {
    for (const h of hosted) await h.remove().catch(() => out('   (could not delete a temporary copy — remove it from the Blob store)'));
  }
}
