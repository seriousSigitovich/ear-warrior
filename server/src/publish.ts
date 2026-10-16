// CLI: `npm run publish -- --file <mp4> --title "…" --description "…" --tags "#a #b"`
// A dry run by default; add --confirm to actually upload/publish. See server/README.md → "Publishing videos".
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { blobHost } from './publish/hosting.js';
import { runPublish } from './publish/run.js';
import { probeVideo } from './publish/video.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

const code = await runPublish(process.argv.slice(2), {
  env: process.env,
  fetchFn: fetch,
  probe: probeVideo,
  readFile,
  host: blobHost(process.env),
  ledgerPath: `${repoRoot}docs/published.json`,
  repoRoot,
  now: () => new Date(),
  // eslint-disable-next-line no-console
  out: (line) => console.log(line),
});
process.exit(code);
