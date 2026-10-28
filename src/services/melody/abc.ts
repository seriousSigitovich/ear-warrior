// Reads the ABC notation of the Nottingham Music Database into plain note lists (pure, no IO).
// Only the melody is read: chord symbols, decorations, grace notes and lyrics are dropped, and a chord
// keeps its top note. Tunes with more than one voice are skipped.
export interface AbcNote {
  midi: number;
  /** Length in quarter-note beats. Tied notes are merged into one note. */
  beats: number;
  /** First note of its bar or of its segment. */
  barStart: boolean;
}

export interface AbcTune {
  /** The X: reference number. */
  number: number;
  title: string;
  /** The S: line (who the tune was collected from), '' when absent. */
  source: string;
  /**
   * Runs of notes with no break inside. A break is a repeat sign, a double bar, a first/second
   * ending, a rest, a part (P:) or key (K:) change: a window across one would join notes that never
   * follow each other in the tune.
   */
  segments: AbcNote[][];
}

export interface AbcSkip {
  number: number;
  title: string;
  reason: string;
}

export interface AbcFile {
  tunes: AbcTune[];
  skipped: AbcSkip[];
}

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
/** Sharps (+) or flats (−) in the major key on each tonic. */
const MAJOR_FIFTHS: Record<string, number> = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7,
  F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6,
};
/** Triplets and the like: `(n` plays n notes in the time of TUPLET_TIME[n]. */
const TUPLET_TIME: Record<number, number> = { 2: 3, 3: 2, 4: 3, 5: 2, 6: 2, 7: 2, 8: 3, 9: 2 };

/** Accidental (+1 / −1) the key signature puts on each note letter. Modes other than minor read as major. */
function keySignature(value: string): Record<string, number> {
  const match = value.trim().match(/^([A-G])([#b]?)(m|min)?(?![a-z])/);
  const accidentals: Record<string, number> = {};
  if (!match) return accidentals;
  const major = MAJOR_FIFTHS[match[1] + match[2]];
  if (major === undefined) return accidentals;
  const fifths = major - (match[3] ? 3 : 0);
  if (fifths > 0) SHARP_ORDER.slice(0, fifths).forEach((l) => (accidentals[l] = 1));
  if (fifths < 0) FLAT_ORDER.slice(0, -fifths).forEach((l) => (accidentals[l] = -1));
  return accidentals;
}

/** "3/4" → 0.75, "C" → 1. */
function meterValue(value: string): number {
  const m = value.trim().match(/^(\d+)\/(\d+)/);
  return m ? Number(m[1]) / Number(m[2]) : 1;
}

function unitValue(value: string): number | undefined {
  const m = value.trim().match(/^(\d+)\/(\d+)/);
  return m ? Number(m[1]) / Number(m[2]) : undefined;
}

/** The ABC default note length: a sixteenth under 3/4 time, an eighth otherwise. */
function defaultUnit(meter: number): number {
  return meter < 0.75 ? 1 / 16 : 1 / 8;
}

const NOTE_RE = /(\^\^|\^|__|_|=)?([A-Ga-g])([',]*)(\d*)(\/*)(\d*)/y;
const REST_RE = /[zxZ](\d*)(\/*)(\d*)/y;
const BAR_RE = /(\|\]|\|\||\|:|:\||::|\[\||\||:)/y;
const CHORD_RE = /\[([^\]\d|][^\]]*)\]/y;

function multiplier(digits: string, slashes: string, after: string): number {
  const num = digits ? Number(digits) : 1;
  if (!slashes) return num;
  const den = after ? Number(after) : 2 ** slashes.length;
  return num / den;
}

function sticky(re: RegExp, s: string, at: number): RegExpExecArray | null {
  re.lastIndex = at;
  return re.exec(s);
}

class TuneReader {
  segments: AbcNote[][] = [];
  private current: AbcNote[] = [];
  private keyAccidentals: Record<string, number>;
  private barAccidentals: Record<string, number> = {};
  private nextStarts = true;
  private tieOpen = false;
  private tupletLeft = 0;
  private tupletRatio = 1;
  private meter = 1;
  private unit: number | undefined;

  constructor(key: string, meter: string | undefined, unit: string | undefined) {
    this.keyAccidentals = keySignature(key);
    this.meter = meter ? meterValue(meter) : 1;
    this.unit = unit ? unitValue(unit) : undefined;
  }

  field(letter: string, value: string): void {
    if (letter === 'K') {
      this.keyAccidentals = keySignature(value);
      this.barAccidentals = {};
      this.breakSegment();
    } else if (letter === 'L') {
      this.unit = unitValue(value) ?? this.unit;
    } else if (letter === 'M') {
      this.meter = meterValue(value);
    } else if (letter === 'P') {
      this.breakSegment();
    }
  }

  finish(): AbcNote[][] {
    this.breakSegment();
    return this.segments;
  }

  private breakSegment(): void {
    if (this.current.length > 0) this.segments.push(this.current);
    this.current = [];
    this.nextStarts = true;
    this.tieOpen = false;
  }

  /** Reads one line of music. */
  line(raw: string): void {
    const s = raw
      .replace(/%.*$/, '')
      .replace(/"[^"]*"/g, '')
      .replace(/![^!]*!/g, '')
      .replace(/\+[^+]*\+/g, '')
      .replace(/\{[^}]*\}/g, '');
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      const bar = sticky(BAR_RE, s, i);
      if (bar) {
        i += bar[0].length;
        this.barline(bar[0]);
        // a first/second ending written `|1` or `:|2`
        if ((s[i] === '1' || s[i] === '2') && bar[0] !== '|]') {
          i++;
          this.breakSegment();
        }
        continue;
      }
      if (c === '[' && (s[i + 1] === '1' || s[i + 1] === '2')) {
        i += 2;
        this.breakSegment();
        continue;
      }
      const chord = c === '[' ? sticky(CHORD_RE, s, i) : null;
      if (chord) {
        i += chord[0].length;
        const tail = sticky(/(\d*)(\/*)(\d*)/y, s, i)!;
        i += tail[0].length;
        this.chord(chord[1], multiplier(tail[1], tail[2], tail[3]));
        continue;
      }
      const tuplet = c === '(' ? sticky(/\((\d)/y, s, i) : null;
      if (tuplet) {
        i += tuplet[0].length;
        const n = Number(tuplet[1]);
        this.tupletLeft = n;
        this.tupletRatio = (TUPLET_TIME[n] ?? n) / n;
        continue;
      }
      const rest = sticky(REST_RE, s, i);
      if (rest) {
        i += rest[0].length;
        this.breakSegment();
        continue;
      }
      const note = sticky(NOTE_RE, s, i);
      if (note) {
        i += note[0].length;
        const midi = this.pitch(note[1], note[2], note[3]);
        this.addNote(midi, multiplier(note[4], note[5], note[6]));
        continue;
      }
      if (c === '-') this.tieOpen = this.current.length > 0;
      i++; // spaces, slurs, ties, staccato dots, rolls, broken-rhythm marks
    }
  }

  private barline(token: string): void {
    this.barAccidentals = {};
    this.nextStarts = true;
    this.tieOpen = this.tieOpen && token === '|';
    if (token !== '|') this.breakSegment();
  }

  private pitch(accidental: string | undefined, letter: string, marks: string): number {
    const upper = letter.toUpperCase();
    const memo = letter + marks;
    let shift: number;
    if (accidental) {
      shift = accidental === '=' ? 0 : accidental[0] === '^' ? accidental.length : -accidental.length;
      this.barAccidentals[memo] = shift;
    } else {
      shift = this.barAccidentals[memo] ?? this.keyAccidentals[upper] ?? 0;
    }
    let octave = letter === upper ? 4 : 5;
    for (const m of marks) octave += m === "'" ? 1 : -1;
    return 12 * (octave + 1) + LETTER_PC[upper] + shift;
  }

  private chord(inner: string, mult: number): void {
    let top: { midi: number; mult: number } | undefined;
    let i = 0;
    while (i < inner.length) {
      const note = sticky(NOTE_RE, inner, i);
      if (!note) {
        i++;
        continue;
      }
      i += note[0].length;
      const midi = this.pitch(note[1], note[2], note[3]);
      if (!top || midi > top.midi) top = { midi, mult: multiplier(note[4], note[5], note[6]) };
    }
    if (top) this.addNote(top.midi, top.mult * mult);
  }

  private addNote(midi: number, mult: number): void {
    let ratio = 1;
    if (this.tupletLeft > 0) {
      ratio = this.tupletRatio;
      this.tupletLeft--;
    }
    const beats = (this.unit ?? defaultUnit(this.meter)) * 4 * mult * ratio;
    const last = this.current[this.current.length - 1];
    if (this.tieOpen && last && last.midi === midi) {
      last.beats += beats;
    } else {
      this.current.push({ midi, beats, barStart: this.nextStarts });
    }
    this.nextStarts = false;
    this.tieOpen = false;
  }
}

/** Parses every tune in an ABC file. */
export function parseAbc(text: string): AbcFile {
  const tunes: AbcTune[] = [];
  const skipped: AbcSkip[] = [];
  const blocks = text.split(/^(?=X:)/m).filter((b) => b.startsWith('X:'));
  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const number = Number(lines[0].slice(2).trim());
    let title = '';
    let source = '';
    let meter: string | undefined;
    let unit: string | undefined;
    let reader: TuneReader | undefined;
    let voices = 0;
    for (const raw of lines.slice(1)) {
      const field = raw.match(/^([A-Za-z]):\s*(.*)$/);
      if (field) {
        const [, letter, value] = field;
        if (letter === 'V') voices++;
        if (!reader) {
          if (letter === 'T' && !title) title = value.trim();
          else if (letter === 'S' && !source) source = value.trim();
          else if (letter === 'M') meter = value;
          else if (letter === 'L') unit = value;
          else if (letter === 'K') reader = new TuneReader(value, meter, unit);
        } else {
          reader.field(letter, value);
        }
        continue;
      }
      if (reader && raw.trim() && !raw.startsWith('%')) reader.line(raw.replace(/\\\s*$/, ''));
    }
    if (voices > 0) skipped.push({ number, title, reason: 'more than one voice' });
    else if (!reader) skipped.push({ number, title, reason: 'no K: line' });
    else tunes.push({ number, title, source, segments: reader.finish() });
  }
  return { tunes, skipped };
}
