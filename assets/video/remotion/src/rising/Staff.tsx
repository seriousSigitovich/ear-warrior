// The melody as real written music, in place of the beads: a guitar staff (treble clef, an octave up), key and time signature, the bars
// from a story's SCORE (king/tunes.mjs `score()`). While the tune plays, every note lights amber as it sounds and the line scrolls to keep the
// sounding note left of centre. VexFlow lays the music out once into two SVG layers: the whole score in dim cream, and the notes alone in
// amber, shown only up to the last note heard (a clip that moves note by note), so a note, its accidental, dot, flag and tie light together.
import React, { useMemo } from 'react';
import { Accidental, Beam, Dot, Formatter, Renderer, Stave, StaveNote, StaveTie, Voice } from 'vexflow';
import { kick, springAt, type SpringCfg } from '../ten/motion';
import { clamp, easeOut } from '../util';
import type { TuneStory, ScoreNote } from '../../king/tunes.d.mts';

const SCALE = 2.6;                      // VexFlow units → px: a staff space of 23.5 px
const BEAT_W = 50;                      // a quarter beat, VexFlow units: a 3/4 bar is 150, a 4/4 bar 200
const PAD = 12;
const STAVE_Y = 34;
const H = 150;
const PLAYHEAD = 500;                   // px from the left where the sounding note sits
const AMBER = '#F2B566';
const CREAM = '#F3E9D6';
const CALM: SpringCfg = { damping: 18, stiffness: 140, mass: 0.9 };

type Head = { order: number; x: number; y: number; left: number };
type Layout = { dim: string; lit: string; width: number; heads: Head[] };

const DURATION: Record<ScoreNote['dur'], string> = { 16: '16', 8: '8', '8.': '8d', q: 'q', 'q.': 'qd', h: 'h', 'h.': 'hd', w: 'w' };

/** Lays the score out once. `notesOnly`: the amber layer, with no staff lines, clef or bar lines. */
function draw(S: NonNullable<TuneStory['SCORE']>, ink: string, notesOnly: boolean) {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden';
  document.body.appendChild(host);
  const beatsPerBar = S.time[0] * (4 / S.time[1]);
  const widths = S.bars.map((bar, i) => {
    const beats = bar.reduce((a, n) => a + n.beats, 0);
    return (i === 0 ? 120 : 0) + BEAT_W * beats;
  });
  const width = PAD * 2 + widths.reduce((a, w) => a + w, 0);
  const renderer = new Renderer(host, Renderer.Backends.SVG);
  renderer.resize(width, H);
  const ctx = renderer.getContext();
  ctx.setFillStyle(ink);
  ctx.setStrokeStyle(ink);

  const all: { note: StaveNote; n: ScoreNote }[] = [];
  let x = PAD;
  S.bars.forEach((bar, i) => {
    const stave = new Stave(x, STAVE_Y, widths[i]);
    if (i === 0) stave.addClef('treble', 'default', '8vb').addKeySignature(S.key).addTimeSignature(`${S.time[0]}/${S.time[1]}`);
    if (i === S.bars.length - 1) stave.setEndBarType(3);   // the final double bar
    stave.setContext(ctx);
    if (!notesOnly) stave.draw();
    const notes = bar.map((n) => {
      const note = new StaveNote({ keys: [`${n.step.toLowerCase()}${n.acc}/${n.octave}`], duration: DURATION[n.dur], auto_stem: true });
      if (n.dur.endsWith('.')) Dot.buildAndAttach([note], { all: true });
      note.setStyle({ fillStyle: ink, strokeStyle: ink });
      note.setLedgerLineStyle({ fillStyle: ink, strokeStyle: ink });
      all.push({ note, n });
      return note;
    });
    // eighths (and sixteenths) that share a beat are beamed together, as a guitar part is written (a lone eighth keeps its flag); a pickup bar counts its
    // beats from where it starts inside the bar, so three pickup eighths read ♪ ♫, not ♫ ♪
    const barBeats = bar.reduce((a, n) => a + n.beats, 0);
    let pos = i === 0 ? beatsPerBar - barBeats : 0;
    const groups: { beat: number; end: number; notes: StaveNote[] }[] = [];
    bar.forEach((n, j) => {
      const beat = Math.floor(pos + 1e-6);
      pos += n.beats;
      if (n.dur !== '8' && n.dur !== '8.' && n.dur !== '16') return;
      const last = groups.at(-1);
      if (last && last.beat === beat && last.end === j) { last.notes.push(notes[j]); last.end = j + 1; }
      else groups.push({ beat, end: j + 1, notes: [notes[j]] });
    });
    const beams = groups.filter((g) => g.notes.length > 1).map((g) => new Beam(g.notes, true));
    beams.forEach((b) => b.setStyle({ fillStyle: ink, strokeStyle: ink }));
    const voice = new Voice({ num_beats: bar.reduce((a, n) => a + n.beats, 0) * (S.time[1] / 4), beat_value: S.time[1] });
    voice.addTickables(notes);
    Accidental.applyAccidentals([voice], S.key);
    new Formatter().joinVoices([voice]).format([voice], stave.getNoteEndX() - stave.getNoteStartX() - 14);
    voice.draw(ctx, stave);
    beams.forEach((b) => b.setContext(ctx).draw());
    x += widths[i];
  });
  all.forEach(({ note, n }, i) => {
    if (n.tie && all[i + 1]) new StaveTie({ first_note: note, last_note: all[i + 1].note, first_indices: [0], last_indices: [0] }).setContext(ctx).draw();
  });

  const heads: Head[] = [];
  all.forEach(({ note, n }, i) => {
    if (i > 0 && all[i - 1].n.tie) return;                // a tied-over note is not a new sound
    heads.push({ order: n.order, x: (note.getNoteHeadBeginX() + note.getNoteHeadEndX()) / 2, y: note.getYs()[0], left: note.getAbsoluteX() - note.getMetrics().modLeftPx - 3 });
  });
  const svg = host.innerHTML;
  host.remove();
  return { svg, width, heads };
}

export const Staff: React.FC<{ t: number; y: number; S: TuneStory; show: number }> = ({ t, y, S, show }) => {
  const layout = useMemo<Layout | null>(() => {
    if (!S.SCORE) return null;
    const dim = draw(S.SCORE, CREAM, false);
    const lit = draw(S.SCORE, AMBER, true);
    return { dim: dim.svg, lit: lit.svg, width: dim.width, heads: dim.heads };
  }, [S]);
  if (!layout || show < 0.01) return null;
  const { heads, width } = layout;
  const { HEARD } = S;

  // the last note heard, and where the playhead is between it and the next
  const k = HEARD.reduce((a, n, i) => (t >= n.t ? i : a), -1);
  const cur = heads[Math.max(0, k)], next = heads[Math.min(heads.length - 1, k + 1)];
  const span = k >= 0 && k + 1 < HEARD.length ? HEARD[k + 1].t - HEARD[k].t : 1;
  const along = k < 0 ? 0 : k + 1 >= HEARD.length ? 0 : easeOut(clamp((t - HEARD[k].t) / span));
  const xHead = cur.x + (next.x - cur.x) * along;
  const tx = clamp(PLAYHEAD - xHead * SCALE, 1080 - 60 - width * SCALE, 60);
  // the amber layer ends just before the next note's accidental
  const clipX = k < 0 ? 0 : k + 1 < heads.length ? heads[k + 1].left : width;

  return (
    <div style={{ position: 'absolute', left: 0, top: y, width: 1080, height: H * SCALE, opacity: show, overflow: 'hidden', WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 5%, #000 95%, transparent 100%)', maskImage: 'linear-gradient(90deg, transparent 0%, #000 5%, #000 95%, transparent 100%)' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width, height: H, transform: `translateX(${tx}px) scale(${SCALE})`, transformOrigin: '0 0' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.42 }} dangerouslySetInnerHTML={{ __html: layout.dim }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: clipX, height: H, overflow: 'hidden', filter: `drop-shadow(0 0 3px rgba(255,154,60,0.75))` }}>
          <div style={{ width, height: H }} dangerouslySetInnerHTML={{ __html: layout.lit }} />
        </div>
        {heads.map((h, i) => {
          const at = HEARD[i]?.t ?? Infinity;
          const p = springAt(t, at, CALM) * kick(t - at, 3.2);
          if (p < 0.02) return null;
          return <div key={i} style={{ position: 'absolute', left: h.x - 14, top: h.y - 14, width: 28, height: 28, borderRadius: 99, background: `radial-gradient(circle, rgba(255,190,110,${0.75 * p}) 0%, rgba(255,154,60,${0.3 * p}) 45%, rgba(255,154,60,0) 72%)` }} />;
        })}
      </div>
    </div>
  );
};
