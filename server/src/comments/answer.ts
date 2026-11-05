// Reads a viewer's answer out of a comment and grades it against the melody of the video.
// Pure: no I/O, so it is covered by answer.test.ts and the report CLI only wires it up.
//
// What people write, in the order it is tried:
//   1. an ASCII tab (two or more lines like `e|--0-3-5--|`)  → exact pitches
//   2. note names: `E B C D`, `Eb4 G#`, `EBCD`, solfège `mi si do re`, `ми си до ре`
//   3. bare fret numbers: `0 3 5 3 0`  → the string is unknown, so a fret run counts as right when some standard-tuning string
//      for each fret gives the melody (in any key)
// Grading compares pitch classes (octaves are ignored) and allows the whole answer in another key, so a melody played higher,
// lower or transposed still counts. Repeated notes may be written once ("E B C D C B A" for "… A A"), and up to two stray
// notes before the melody are skipped.

export type Kind = 'tab' | 'names' | 'frets';
export interface Parsed {
  kind: Kind;
  /** Pitch classes 0–11 (names, tab) or fret numbers (frets). */
  values: number[];
}
export interface Grade {
  verdict: 'correct' | 'partial' | 'wrong';
  kind: Kind;
  /** How many notes of the answer were read. */
  given: number;
  /** Leading notes that match the melody. */
  matched: number;
  /** Notes in the melody. */
  total: number;
  /** Semitones between the answer and the melody, 0 = the same key. Null for frets. */
  shift: number | null;
  /** First wrong note: what the comment says and what the melody has (names; frets as numbers). */
  miss: { at: number; said: string; expected: string } | null;
}

const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11, H: 11 };
const SOLFEGE: Record<string, number> = {
  do: 0, re: 2, mi: 4, fa: 5, sol: 7, so: 7, la: 9, si: 11, ti: 11,
  до: 0, ре: 2, ми: 4, фа: 5, соль: 7, ля: 9, си: 11,
};
/** Standard tuning, low E to high E. */
const OPEN = [40, 45, 50, 55, 59, 64];
const MIN_RUN = 3;

export const pcName = (pc: number) => PC_NAMES[((pc % 12) + 12) % 12];

const ACC = '(#|♯|b|♭)?';
const NOTE_RE = new RegExp(`^([A-Ha-h])${ACC}(-?\\d)?$`);
const accidental = (a: string | undefined) => (a === '#' || a === '♯' ? 1 : a === 'b' || a === '♭' ? -1 : 0);

/** One token → pitch class, or null (`C`, `c#`, `Eb4`, `H`, `mi`, `соль`). */
function notePc(tok: string): number | null {
  const m = NOTE_RE.exec(tok);
  if (m) {
    const letter = m[1].toUpperCase();
    // `b` alone is the note B; `Bb` is B flat; `bb` (lower) too.
    return (LETTER[letter] + accidental(m[2]) + 12) % 12;
  }
  const s = /^([a-zа-яё]+)(#|♯|b|♭)?\d?$/i.exec(tok);
  if (s && SOLFEGE[s[1].toLowerCase()] !== undefined) return (SOLFEGE[s[1].toLowerCase()] + accidental(s[2]) + 12) % 12;
  return null;
}

/** `EBCDCBA` / `C#DE` written without spaces: only upper-case letters (so ordinary words are left alone). */
function gluedPcs(tok: string): number[] | null {
  if (!/^(?:[A-G][#♯b♭]?){3,}$/.test(tok)) return null;
  const out: number[] = [];
  for (const m of tok.matchAll(/([A-G])([#♯b♭]?)/g)) out.push((LETTER[m[1]] + accidental(m[2] || undefined) + 12) % 12);
  return out;
}

const SPLIT = /[\s,;.:!?\-–—>→|/\\()[\]{}"'«»*_~+]+/u;

/** The longest run of consecutive note tokens in a line. */
function longestRun<T>(tokens: string[], read: (t: string) => T[] | null): T[] {
  let best: T[] = [];
  let cur: T[] = [];
  for (const t of tokens) {
    const v = read(t);
    if (v) cur.push(...v);
    else {
      if (cur.length > best.length) best = cur;
      cur = [];
    }
  }
  return cur.length > best.length ? cur : best;
}

/** Multi-line ASCII tab (`e|--0-3--|` rows) → pitch classes in column order. */
function parseTab(text: string): number[] | null {
  const rows: { label: string; line: string }[] = [];
  for (const raw of text.split('\n')) {
    const m = /^\s*([eEBGDA])\s*[|:]?\s*([-0-9|hpbrx/\\~ ]*--[-0-9|hpbrx/\\~ ]*)$/.exec(raw);
    if (m) rows.push({ label: m[1], line: m[2] });
  }
  if (rows.length < 2) return null;
  // Tabs are written high string on top: of two E rows the upper one is the high E, whatever its case.
  const eRows = rows.filter((r) => r.label === 'e' || r.label === 'E');
  const stringOf = (r: (typeof rows)[number]) =>
    r.label === 'e' || r.label === 'E' ? (eRows.length === 2 ? (r === eRows[0] ? 5 : 0) : r.label === 'e' ? 5 : 0) : { A: 1, D: 2, G: 3, B: 4 }[r.label]!;
  const hits: { col: number; midi: number }[] = [];
  for (const r of rows) for (const m of r.line.matchAll(/\d{1,2}/g)) hits.push({ col: m.index ?? 0, midi: OPEN[stringOf(r)] + Number(m[0]) });
  if (hits.length < MIN_RUN) return null;
  hits.sort((a, b) => a.col - b.col);
  return hits.map((h) => h.midi % 12);
}

/** Read the answer in a comment, or null when it holds none (praise, questions, emoji). */
export function parseAnswer(text: string): Parsed | null {
  const tab = parseTab(text);
  if (tab) return { kind: 'tab', values: tab };
  let names: number[] = [];
  let frets: number[] = [];
  for (const line of text.split('\n')) {
    const tokens = line.split(SPLIT).filter(Boolean);
    const n = longestRun(tokens, (t) => {
      const pc = notePc(t);
      return pc !== null ? [pc] : gluedPcs(t);
    });
    // A lone "a" or "do" in a sentence is not an answer: a run needs three notes in a row.
    if (n.length > names.length) names = n;
    const f = longestRun(tokens, (t) => (/^\d{1,2}$/.test(t) && Number(t) <= 24 ? [Number(t)] : null));
    if (f.length > frets.length) frets = f;
  }
  if (names.length >= MIN_RUN && names.length >= frets.length) return { kind: 'names', values: names };
  if (frets.length >= MIN_RUN) return { kind: 'frets', values: frets };
  return null;
}

const dedupe = (xs: number[]) => xs.filter((x, i) => i === 0 || x !== xs[i - 1]);

/** Leading notes of `a` that equal `m` shifted by `k` semitones. */
function prefixMatch(a: number[], m: number[], k: number): number {
  let i = 0;
  while (i < a.length && i < m.length && (a[i] - m[i] - k) % 12 === 0) i++;
  return i;
}

/** Frets: leading frets for which some string gives the melody note + k. */
function fretPrefix(frets: number[], melody: number[], k: number): number {
  let i = 0;
  while (i < frets.length && i < melody.length && OPEN.some((o) => o + frets[i] === melody[i] + k)) i++;
  return i;
}

/** Grade an answer against the melody (MIDI notes). */
export function grade(p: Parsed, melodyMidi: number[]): Grade {
  const total = melodyMidi.length;
  const verdictOf = (matched: number, given: number): Grade['verdict'] =>
    matched === given && matched >= Math.min(total, MIN_RUN) ? 'correct' : matched >= MIN_RUN ? 'partial' : 'wrong';

  if (p.kind === 'frets') {
    let best = { matched: -1, k: 0 };
    for (let k = -36; k <= 36; k++) {
      const m = fretPrefix(p.values, melodyMidi, k);
      if (m > best.matched || (m === best.matched && Math.abs(k) < Math.abs(best.k))) best = { matched: m, k };
    }
    const at = best.matched;
    const miss = at < p.values.length && at < total ? { at, said: String(p.values[at]), expected: pcName(melodyMidi[at] % 12) } : null;
    return { verdict: verdictOf(at, Math.min(p.values.length, total)), kind: p.kind, given: p.values.length, matched: at, total, shift: null, miss };
  }

  // Names / tab: pitch classes, any key, then the same with repeated notes collapsed.
  const pcs = melodyMidi.map((m) => m % 12);
  // Also with one or two stray notes in front ("A E D# D …": a pickup, or a note from before the phrase).
  const tries: { a: number[]; m: number[] }[] = [];
  for (const skip of [0, 1, 2]) {
    const a = p.values.slice(skip);
    if (a.length >= MIN_RUN) tries.push({ a, m: pcs }, { a: dedupe(a), m: dedupe(pcs) });
  }
  let best = { matched: -1, k: 0, a: p.values, m: pcs };
  for (const t of tries) {
    for (let k = 0; k < 12; k++) {
      const matched = prefixMatch(t.a, t.m, k);
      // Prefer the same key, then the plain (not collapsed) reading, when they tie.
      if (matched > best.matched) best = { matched, k, ...t };
    }
  }
  const { matched, k, a, m } = best;
  const given = Math.min(a.length, m.length);
  const miss = matched < a.length && matched < m.length ? { at: matched, said: pcName(a[matched]), expected: pcName((m[matched] + k) % 12) } : null;
  return { verdict: verdictOf(matched, given), kind: p.kind, given: a.length, matched, total: m.length, shift: k === 0 ? 0 : k > 6 ? k - 12 : k, miss };
}

/** A short public reply for the commenter (English: the audience is). Null when there is nothing to say. */
export function draftReply(g: Grade): string | null {
  const key = g.shift ? ' (in another key — still counts)' : '';
  if (g.verdict === 'correct') {
    return g.matched >= g.total
      ? `✅ All ${g.total} notes, by ear${key}. That's it!`
      : `✅ Right — the first ${g.matched} of ${g.total} notes${key}. Keep going!`;
  }
  if (g.verdict === 'partial' && g.miss) {
    return `🔥 So close: the first ${g.matched} notes are right${key}. Note ${g.miss.at + 1} is off — listen again from there.`;
  }
  if (g.verdict === 'wrong') return '🎧 Not quite yet — try the first three notes again and trust your ear.';
  return null;
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}']+/gu, ' ').trim();

/** The comment names the tune (one of its aliases, as whole words) instead of writing its notes. */
export function namesTune(text: string, aliases: readonly string[]): boolean {
  const t = ` ${norm(text)} `;
  return aliases.some((a) => a && t.includes(` ${norm(a)} `));
}

export const NAMED_REPLY = "✅ That's the one! Now the real test: can you play it on guitar by ear? 🎸";
