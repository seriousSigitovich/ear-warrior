// Pitch-stream segmentation (FR-004, R3): turn per-frame pitch into discrete notes. Two concerns
// that used to be one comparison (`this frame vs the note's very first frame`) are now separate:
// - Boundary detection: a note ends on a silence gap, or on a pitch change that *persists* for
//   `onsetConfirmFrames` frames. A single glitchy frame (attack transient, stray octave read) can no
//   longer fracture a note, because a deviation that doesn't sustain is folded back into it.
// - Pitch estimation: once a note's window is closed, its reported pitch is the median over the
//   window with the leading `attackGuardMs` dropped — the attack is the least reliable part of a
//   plucked note, so it's excluded from the estimate rather than anchoring it.
// A note is emitted only if its full window (including the attack) sustains for at least
// `minNoteMs`. Pure function over a frame array — no IO.
import { DetectedNote, PitchFrame, SegmentConfig } from '../models';
import { centsFromHz, midiFromHz } from './pitchNote';

function isVoiced(f: PitchFrame, cfg: SegmentConfig): boolean {
  return f.hz > 0 && f.clarity >= cfg.clarityThreshold && f.hz >= cfg.minHz && f.hz <= cfg.maxHz;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** The note's running identity: the median pitch of its confirmed frames so far. */
function groupMidi(group: PitchFrame[]): number {
  return midiFromHz(median(group.map((f) => f.hz)));
}

export function segmentFrames(frames: PitchFrame[], cfg: SegmentConfig): DetectedNote[] {
  const notes: DetectedNote[] = [];
  let group: PitchFrame[] = [];
  // Consecutive frames that disagree with `group`'s identity — a candidate for the *next* note.
  // Promoted to a real split only once it reaches onsetConfirmFrames; otherwise it was a glitch and
  // gets folded back into `group` the moment a frame agrees with `group` again.
  let pendingChange: PitchFrame[] = [];
  let lastVoicedTs: number | null = null;

  const flush = (g: PitchFrame[]) => {
    if (g.length === 0) {
      return;
    }
    const durationMs = g[g.length - 1].timestampMs - g[0].timestampMs;
    if (durationMs < cfg.minNoteMs) {
      return;
    }
    const guardCutoffMs = g[0].timestampMs + cfg.attackGuardMs;
    const stable = g.filter((f) => f.timestampMs >= guardCutoffMs);
    const pitchSource = stable.length > 0 ? stable : g;
    const medianHz = median(pitchSource.map((f) => f.hz));
    notes.push({
      index: notes.length,
      midi: midiFromHz(medianHz),
      frequencyHz: medianHz,
      centsOffset: centsFromHz(medianHz),
      clarity: median(pitchSource.map((f) => f.clarity)),
      startMs: g[0].timestampMs,
      endMs: g[g.length - 1].timestampMs,
    });
  };

  const closeGroup = () => {
    flush(group);
    group = [];
    pendingChange = [];
  };

  for (const f of frames) {
    if (!isVoiced(f, cfg)) {
      // Silence: split the current note once the gap since the last voiced frame exceeds gapMs.
      if (group.length > 0 && lastVoicedTs !== null && f.timestampMs - lastVoicedTs >= cfg.gapMs) {
        closeGroup();
      }
      continue;
    }

    if (group.length === 0) {
      group.push(f);
      lastVoicedTs = f.timestampMs;
      continue;
    }

    const gapExceeded = lastVoicedTs !== null && f.timestampMs - lastVoicedTs >= cfg.gapMs;
    if (gapExceeded) {
      closeGroup();
      group.push(f);
      lastVoicedTs = f.timestampMs;
      continue;
    }

    const frameMidi = midiFromHz(f.hz);
    if (frameMidi === groupMidi(group)) {
      // Agrees with the note so far — any pending candidate was a false alarm, reabsorb it too.
      group.push(...pendingChange, f);
      pendingChange = [];
      lastVoicedTs = f.timestampMs;
      continue;
    }

    // Disagrees — accumulate as a candidate for the next note, but only if it agrees with itself.
    pendingChange =
      pendingChange.length > 0 && midiFromHz(pendingChange[0].hz) !== frameMidi
        ? [f] // the candidate wasn't self-consistent either — restart it on this frame
        : [...pendingChange, f];
    lastVoicedTs = f.timestampMs;

    if (pendingChange.length >= cfg.onsetConfirmFrames) {
      // Sustained pitch change: close the note on the old pitch, start the next on the new one.
      flush(group);
      group = pendingChange;
      pendingChange = [];
    }
  }
  closeGroup();

  return notes;
}
