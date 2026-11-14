#!/usr/bin/env node
// House of the Rising Sun on #60's cut in the warm-wood look:  node render-rising.mjs  →  public/rising-wood.wav + out/rising-wood.mp4 (1080×1920, 60 fps)
// Timeline = king/tunes.mjs `rising`, picture in src/rising/RisingWood.tsx, soundtrack king/audio.mjs on that timeline.
//   --tune=<id>  another tune in the same look (WOOD_TUNES in RisingWood.tsx: canon, scarborough, greensleeves, birthday, gladiators (no wood, BOARDLESS), darkeyes, bulerias, cucaracha, hava, polkka, habanera, sailor, condor (a looping cut: melody from frame 0, "? ? ?" slots, no crane))
//                → public/wood-<id>.wav + out/wood-<id>.mp4, composition Wood-<id>; check it with  node king/check.mjs --tune=<id> --wav=wood-<id>.wav
//   --look=<noneck|ghost|embers>  #71 without the neck, same soundtrack → out/rising-<look>.mp4: noneck = the notes still fall, nothing under
//                them (RisingWood-noneck) · ghost = a string shows only while it rings (RisingWood-ghost) · embers = campfire embers hang
//                as a garland by pitch, no guitar at all (src/rising/RisingEmbers.tsx)
//   --cover  a frame of the hook → out/<name>-cover.{png,jpg}
//   --audio-only        just the soundtrack            --still=<seconds>[,<seconds>…]   PNG frames → out/frames/
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finalizeLoudness } from './ten/audio.mjs';
import { renderKingAudio } from './king/audio.mjs';
import { TUNES } from './king/tunes.mjs';

const tune = process.argv.find((a) => a.startsWith('--tune='))?.slice(7) ?? 'rising';
const story = TUNES[tune];
if (!story) throw new Error(`no tune "${tune}" in king/tunes.mjs`);
const LOOKS = { noneck: 'RisingWood-noneck', ghost: 'RisingWood-ghost', embers: 'RisingEmbers' };
const look = process.argv.find((a) => a.startsWith('--look='))?.slice(7);
if (look && (!LOOKS[look] || tune !== 'rising')) throw new Error(`--look takes ${Object.keys(LOOKS).join('|')}, for #71 (rising) only`);
const wavName = tune === 'rising' ? 'rising-wood' : `wood-${tune}`;  // #71 keeps its file names; must match woodWav() in RisingWood.tsx
const name = look ? `rising-${look}` : wavName;
const comp = look ? LOOKS[look] : tune === 'rising' ? 'RisingWood' : `Wood-${tune}`;
const COVER_AT = story.LOOP ? 1.4 : 0.9;                        // the hook fully set, the neck revealed (a looping cut brings its words in over the first notes)

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'out'), { recursive: true });
const remotion = join(here, 'node_modules', '.bin', 'remotion');
const still = process.argv.find((a) => a.startsWith('--still='));
if (still) {
  mkdirSync(join(here, 'out', 'frames'), { recursive: true });
  for (const sec of still.slice(8).split(',').map(Number)) {
    const png = join(here, 'out', 'frames', `${name}_${sec}.png`);
    execFileSync(remotion, ['still', 'src/index.ts', comp, png, `--frame=${Math.round(sec * story.FPS)}`, '--log=error'], { cwd: here, stdio: 'inherit' });
    console.log(`${name}: → ${png}`);
  }
  process.exit(0);
}
if (process.argv.includes('--cover')) {
  const png = join(here, 'out', `${name}-cover.png`), jpg = png.replace(/png$/, 'jpg');
  execFileSync(remotion, ['still', 'src/index.ts', comp, png, `--frame=${Math.round(COVER_AT * story.FPS)}`, '--log=error'], { cwd: here, stdio: 'inherit' });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '2', jpg]);
  console.log(`${name}: → ${jpg}`);
  process.exit(0);
}
const wav = join(here, 'public', `${wavName}.wav`);
const { peak, measureText } = renderKingAudio(wav, story);
const l = finalizeLoudness(wav, measureText);
console.log(`${name}: audio peak ${peak.toFixed(2)} → ${Number(l.input_i).toFixed(1)} LUFS in, normalised to −14 LUFS`);
if (process.argv.includes('--audio-only')) process.exit(0);
const mp4 = join(here, 'out', `${name}.mp4`);
execFileSync(remotion, ['render', 'src/index.ts', comp, mp4, '--concurrency=8', '--log=error'], { cwd: here, stdio: 'inherit' });
console.log(`${name}: → ${mp4}`);
