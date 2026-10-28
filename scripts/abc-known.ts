// Pulls the recognisable tunes out of a folder of Nottingham ABC files and writes their openings,
// grouped by cell of the library plan (note band × base), as a markdown list to pick from. Adds
// nothing to candidates.ts.
//
//   server/node_modules/.bin/tsx scripts/abc-known.ts <abc dir> <out.md>
//
// For every tune it takes the opening (the first note of the first part) cut at each bar line, and
// keeps the longest cut in each note band. `S:` is who the Nottingham database collected the tune
// from; it says nothing about rights. `PD` lists the few composers I know, from memory: check them.
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { CANDIDATES } from '../src/services/melody/candidates';
import { parseAbc } from '../src/services/melody/abc';
import {
  Base,
  NOTE_BANDS,
  bandOf,
  classify,
  fitToNeck,
  parseMelody,
} from '../src/services/melody/classify';
import { CURATED } from '../src/services/melody/curated';
import { BASES, TARGET, cellCounts } from '../src/services/melody/plan';
import { noteName } from '../src/lib/pitchNote';

const EXCLUDED_FILES = new Set(['ashover.abc']);

/** Corpus titles that most players know. A tune with a known composer carries who and when. */
const KNOWN: { title: string; pd?: string }[] = [
  { title: 'Drunken Sailor' },
  { title: 'Oh Susanna', pd: 'Stephen Foster, d. 1864, 1848' },
  { title: 'Saints' },
  { title: 'Grand Old Duke of York' },
  { title: 'Keel Row' },
  { title: 'The Holly and the Ivy' },
  { title: 'Arkensas Traveller' },
  { title: 'Blaydon Races' },
  { title: 'Blue Bells of Scotland' },
  { title: 'Bonnie Dundee' },
  { title: 'Brighton Camp' },
  { title: 'Buffalo Gals' },
  { title: 'Cripple Creek' },
  { title: 'Daisy Daisy', pd: 'Harry Dacre, d. 1922, 1892' },
  { title: 'Golden Slippers', pd: 'James Bland, d. 1911, 1879' },
  { title: 'God rest you, merry gentlemen' },
  { title: 'Good Christian Men Rejoice' },
  { title: 'Green Grow the Rushes' },
  { title: 'Huntsman\'s Chorus', pd: 'Carl Maria von Weber, d. 1826, 1821' },
  { title: 'Irish Washerwoman' },
  { title: 'It\'s a Long Way to Tipperary', pd: 'Jack Judge, d. 1938, 1912' },
  { title: 'John Brown\'s Body' },
  { title: 'John Peel' },
  { title: 'Liberty Bell', pd: 'John Philip Sousa, d. 1932, 1893' },
  { title: 'Little Brown Jug', pd: 'Eastburn Winner, d. 1902, 1869' },
  { title: 'Little Liza Jane' },
  { title: 'Londonderry Hornpipe' },
  { title: 'Marching Through Georgia', pd: 'Henry Clay Work, d. 1884, 1865' },
  { title: 'Oh Dear, What Can The Matter Be' },
  { title: 'Old Joe Clark 1' },
  { title: 'Pack Up Your Troubles', pd: 'Felix Powell, d. 1942, 1915' },
  { title: 'Polly Put the Kettle on' },
  { title: 'Pop Goes the Wheezle' },
  { title: 'Rosin The Beau' },
  { title: 'Sailor\'s Hornpipe' },
  { title: 'Scotland the Brave' },
  { title: 'She\'ll be Coming Round the Mountain' },
  { title: 'Sir Roger de Coverley' },
  { title: 'Soldiers\' Joy' },
  { title: 'Swannee', pd: 'Stephen Foster (Old Folks at Home), d. 1864, 1851' },
  { title: 'The Hundred Pipers' },
  { title: 'The Minstrel Boy' },
  { title: 'The Lark in the Clear Air' },
  { title: 'The Rocky Road To Dublin' },
  { title: 'Turkey in the Straw' },
  { title: 'Ye Banks and Braes' },
  { title: 'William Tell Overture', pd: 'Gioachino Rossini, d. 1868, 1829' },
  { title: 'Sally Gardens' },
  { title: 'Wassail 1' },
  { title: 'On Christmas Night' },
  { title: 'Garry Owen' },
  { title: 'Haste To The Wedding' },
  { title: 'Dashing White Sergeant' },
  { title: 'Boil \'Em Cabbage Down' },
  { title: 'Ho Ro My Nut Brown Maiden' },
  { title: 'The Leaving of Liverpool' },
  { title: 'Lannigan\'s Ball' },
  { title: 'Rory O\'More' },
  { title: 'The Rogue\'s March' },
];

const [dir, out] = process.argv.slice(2);
if (!dir || !out) {
  console.error('usage: abc-known.ts <abc dir> <out.md>');
  process.exit(1);
}

interface Pick {
  title: string;
  where: string;
  source: string;
  pd?: string;
  notes: string;
  noteCount: number;
  maxLeap: number;
}

const tunes = readdirSync(dir)
  .filter((f) => f.endsWith('.abc') && !EXCLUDED_FILES.has(f))
  .sort()
  .flatMap((file) => parseAbc(readFileSync(join(dir, file), 'utf8')).tunes.map((t) => ({ file, t })));

const cells = NOTE_BANDS.map(() => BASES.map(() => [] as Pick[]));
const missing: string[] = [];
const seenPatterns = NOTE_BANDS.map(() => BASES.map(() => new Set<string>()));

for (const known of KNOWN) {
  const found = tunes.filter(({ t }) => t.title.toLowerCase() === known.title.toLowerCase());
  if (found.length === 0) missing.push(known.title);
  for (const { file, t } of found) {
    const seg = t.segments[0];
    if (!seg) continue;
    const longest = new Map<number, { midis: number[]; beats: number[]; base: Base; maxLeap: number }>();
    for (let n = NOTE_BANDS[0].min; n <= NOTE_BANDS[NOTE_BANDS.length - 1].max && n <= seg.length; n++) {
      if (n < seg.length && !seg[n].barStart) continue;
      const midis = fitToNeck(seg.slice(0, n).map((x) => x.midi));
      if (!midis || new Set(midis).size < 3) continue;
      const c = classify(midis);
      if (c.maxLeap > 12) continue;
      longest.set(NOTE_BANDS.indexOf(bandOf(n)!), {
        midis,
        beats: seg.slice(0, n).map((x) => x.beats),
        base: c.base,
        maxLeap: c.maxLeap,
      });
    }
    longest.forEach((w, band) => {
      const row = BASES.indexOf(w.base);
      const pattern = w.midis.map((m) => m - w.midis[0]).join(',');
      if (seenPatterns[band][row].has(pattern)) return; // e.g. the three Wassails that share an opening
      seenPatterns[band][row].add(pattern);
      cells[band][row].push({
        title: t.title,
        where: `${file} #${t.number}`,
        source: t.source,
        pd: known.pd,
        notes: w.midis
          .map((m, k) => `${noteName(m)}:${Math.max(0.25, Math.round(w.beats[k] * 4) / 4)}`)
          .join(' '),
        noteCount: w.midis.length,
        maxLeap: w.maxLeap,
      });
    });
  }
}

const existing = cellCounts(
  [...CURATED, ...CANDIDATES].map((t) => classify(parseMelody(t.notes).map((n) => n.midi))),
);

const lines: string[] = [
  '# Recognisable tunes from the Nottingham corpus, by cell of the plan',
  '',
  'Generated by `scripts/abc-known.ts`. Nothing here is in `candidates.ts`. Every line is the opening of',
  'a tune, cut at a bar line, as `pitch:beats`; the base and note count come from the notes.',
  '`need` is how many tunes the cell still lacks after `CURATED` + `CANDIDATES`.',
  'Nottingham does not state a licence: the tune is folk, the compilation is Eric Foxley\'s. `PD` is a',
  'composer I know, from memory — verify it. `S:` is the collector the database credits.',
  '',
];
NOTE_BANDS.forEach((band, i) => {
  BASES.forEach((base, j) => {
    const need = Math.max(0, TARGET[i][j] - existing[i][j]);
    const picks = cells[i][j].sort((a, b) => a.maxLeap - b.maxLeap || a.title.localeCompare(b.title));
    lines.push(`## ${band.label} notes · ${base} · ${need === 0 ? 'full' : `need ${need}`} · ${picks.length} here`, '');
    if (picks.length === 0) lines.push('_none_', '');
    for (const p of picks) {
      const tags = [p.where, p.source && `S: ${p.source}`, p.pd && `PD: ${p.pd}`].filter(Boolean);
      lines.push(`- **${p.title}** — ${p.noteCount} notes, leap ${p.maxLeap} (${tags.join('; ')})`, `  \`${p.notes}\``);
    }
    if (picks.length) lines.push('');
  });
});
if (missing.length) lines.push('## Not found in the corpus', '', missing.join(', '), '');

writeFileSync(out, lines.join('\n'));
const total = cells.flat().reduce((n, c) => n + c.length, 0);
console.log(`${tunes.length} tunes read; ${KNOWN.length - missing.length}/${KNOWN.length} known titles found; ${total} openings written to ${out}`);
if (missing.length) console.log(`not found: ${missing.join(', ')}`);
BASES.forEach((base, j) => {
  console.log(base.padEnd(12) + NOTE_BANDS.map((b, i) => `${b.label}:${cells[i][j].length}`).join('  '));
});
