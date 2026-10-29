// Writes the served library as JSON for the offline audio renderer (assets/guitar-rig/render_library.py):
// every tune's id and its notes as [midi, beats] pairs.
//
//   server/node_modules/.bin/tsx scripts/export-library.ts <out.json>
import { writeFileSync } from 'fs';
import { parseMelody } from '../src/services/melody/classify';
import { LIBRARY } from '../src/services/melody/curated';

const out = process.argv[2];
if (!out) throw new Error('usage: export-library.ts <out.json>');
const tunes = LIBRARY.map((t) => ({
  id: t.id,
  notes: parseMelody(t.notes).map((n) => [n.midi, n.beats]),
}));
writeFileSync(out, JSON.stringify(tunes));
console.log(`${tunes.length} tunes -> ${out}`);
