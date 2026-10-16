// The publish command's logic, with every side effect injected so it can be tested:
//   plan first (always), send only with --confirm, one platform's failure never blocks the other.
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { addEntry, findEntry, loadLedger, relativeFile } from './ledger.js';
import { publishReel } from './instagram.js';
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
}

const OPTIONS = {
  file: { type: 'string' },
  platforms: { type: 'string', default: 'youtube,instagram' },
  title: { type: 'string' },
  description: { type: 'string' },
  caption: { type: 'string' },
  tags: { type: 'string' },
  'video-no': { type: 'string' },
  category: { type: 'string' },
  confirm: { type: 'boolean', default: false },
  'no-publish': { type: 'boolean', default: false },
  force: { type: 'boolean', default: false },
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
  if (!values.file) {
    out('✗ --file is required, e.g. --file assets/video/challenge/out/H14_youtube-A/ear-challenge-31.mp4');
    return 2;
  }
  const platforms = (values.platforms ?? '').split(',').map((s) => s.trim()).filter(Boolean) as PlatformName[];
  const unknown = platforms.filter((p) => p !== 'youtube' && p !== 'instagram');
  if (unknown.length || platforms.length === 0) {
    out(`✗ --platforms must be a comma list of youtube, instagram (got "${values.platforms}")`);
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
  const ledger = loadLedger(deps.ledgerPath);

  out(`Video: ${rel} (${probe.durationS.toFixed(1)} s, ${probe.width}x${probe.height}, ${probe.videoCodec}/${probe.audioCodec ?? 'no audio'}, ${(probe.sizeBytes / 1024 / 1024).toFixed(1)} MB)${videoNo !== null ? ` — experiment #${videoNo}` : ''}`);

  const planned: Planned[] = [];
  for (const platform of platforms) {
    const plan: Planned = { platform, blocked: validateForPlatform(probe, platform) };
    try {
      if (platform === 'youtube') {
        plan.youtube = buildYoutube({ title: values.title ?? '', description: values.description ?? '', tags, videoNo });
      } else {
        plan.instagram = buildInstagram({ caption: values.caption ?? values.description ?? '', tags });
      }
    } catch (err) {
      plan.blocked.push((err as Error).message);
    }
    const prior = findEntry(ledger, rel, platform);
    if (prior && !values.force) plan.blocked.push(`already published: ${prior.url} (use --force to publish again)`);
    planned.push(plan);

    out(`── ${NAMES[platform]} (${platform === 'youtube' ? 'Short, uploaded private' : values['no-publish'] ? 'Reel, stage only' : 'Reel'})`);
    if (plan.youtube) {
      out(`   title: ${plan.youtube.title}`);
      out(`   description:\n${indent(plan.youtube.description, '     ')}`);
      out(`   tags: ${plan.youtube.tags.join(', ') || '(none)'}`);
    }
    if (plan.instagram) out(`   caption:\n${indent(plan.instagram.caption, '     ')}`);
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
          { bytes, title: plan.youtube.title, description: plan.youtube.description, tags: plan.youtube.tags, categoryId: values.category },
        );
        addEntry(deps.ledgerPath, { file: rel, videoNo, platform: 'youtube', postId: r.id, url: r.url, visibility: 'private', title: plan.youtube.title, publishedAt: deps.now().toISOString() });
        out(`✓ YouTube: ${r.url} (uploaded PRIVATE — publish it in Studio: ${r.studioUrl})`);
      } else if (plan.instagram) {
        const publish = !values['no-publish'];
        // Meta downloads the video from a temporary public copy; take it down whatever happens.
        const hosted = await deps.host(bytes, rel.split('/').pop() ?? 'video.mp4');
        let r;
        try {
          r = await publishReel({ fetchFn: deps.fetchFn, env: deps.env, sleep: deps.sleep }, { videoUrl: hosted.url, caption: plan.instagram.caption, publish });
        } finally {
          await hosted.remove().catch(() => out('   (could not delete the temporary copy — remove it from the Blob store)'));
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
