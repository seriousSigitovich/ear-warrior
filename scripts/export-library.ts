// Writes the served library as JSON for the offline audio renderer (assets/guitar-rig/render_library.py):
// every tune's id, its own tempo and its notes as [midi, beats] pairs.
//
//   server/node_modules/.bin/tsx scripts/export-library.ts <out.json>
import { writeFileSync } from 'fs';
import { TUNES } from '../server/src/tunes/library.data';
import { parseNotes } from '../server/src/tunes/notes';

const out = process.argv[2];
if (!out) throw new Error('usage: export-library.ts <out.json>');
const tunes = TUNES.map((t) => ({
  id: t.id,
  rank: t.rank,
  bpm: t.tempoBpm,
  notes: (parseNotes(t.notes) ?? []).map((n) => [n.midi, n.beats]),
}));
writeFileSync(out, JSON.stringify(tunes));
console.log(`${tunes.length} tunes -> ${out}`);
