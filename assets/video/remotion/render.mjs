#!/usr/bin/env node
// One command per tune:   node render.mjs tunes/turkish-march.json [tunes/other.json …] [--audio-only]
//   → public/<id>.wav (soundtrack), out/<id>.props.json (what the composition receives), out/<id>.mp4 (1080×1920, 60 fps, 7 s)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTune } from './tune.mjs';
import { renderAudio } from './audio.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const audioOnly = args.includes('--audio-only');
const files = args.filter((a) => !a.startsWith('--'));
if (!files.length) { console.error('usage: node render.mjs tunes/<tune>.json [more.json …] [--audio-only]'); process.exit(1); }

mkdirSync(join(here, 'out'), { recursive: true });
for (const file of files) {
  let tune;
  try { tune = resolveTune(JSON.parse(readFileSync(file, 'utf8'))); }
  catch (e) { console.error(`${file}: ${e.message}`); process.exit(1); }

  const peak = renderAudio(tune, join(here, 'public', tune.audio));
  console.log(`${tune.id}: ${tune.notes.length} notes, ${tune.bpm} bpm, audio peak ${peak.toFixed(2)}`);
  if (audioOnly) continue;

  const props = join(here, 'out', `${tune.id}.props.json`);
  writeFileSync(props, JSON.stringify(tune, null, 2));
  const mp4 = join(here, 'out', `${tune.id}.mp4`);
  execFileSync(join(here, 'node_modules', '.bin', 'remotion'), ['render', 'src/index.ts', 'Tune', mp4, `--props=${props}`, '--log=error'], { cwd: here, stdio: 'inherit' });
  console.log(`${tune.id}: → ${mp4}`);
}
