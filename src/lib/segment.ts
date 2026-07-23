// Pitch-stream segmentation (FR-004, R3): turn per-frame pitch into discrete notes with a
// stability + gap heuristic. Pure function over a frame array — no IO. A new note starts on a
// nearest-note (pitch) change or after a silence gap; a note is emitted only if it sustains for
// at least `minNoteMs`. Each emitted note carries the median frequency and median clarity over
// its stable window (median clarity feeds attempt confidence, FR-017).
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

export function segmentFrames(frames: PitchFrame[], cfg: SegmentConfig): DetectedNote[] {
  const notes: DetectedNote[] = [];
  let group: PitchFrame[] = [];
  let lastVoicedTs: number | null = null;

  const flush = () => {
    if (group.length === 0) {
      return;
    }
    const durationMs = group[group.length - 1].timestampMs - group[0].timestampMs;
    if (durationMs >= cfg.minNoteMs) {
      const medianHz = median(group.map((f) => f.hz));
      notes.push({
        index: notes.length,
        midi: midiFromHz(medianHz),
        frequencyHz: medianHz,
        centsOffset: centsFromHz(medianHz),
        clarity: median(group.map((f) => f.clarity)),
        startMs: group[0].timestampMs,
        endMs: group[group.length - 1].timestampMs,
      });
    }
    group = [];
  };

  for (const f of frames) {
    if (!isVoiced(f, cfg)) {
      // Silence: split the current note once the gap since the last voiced frame exceeds gapMs.
      if (group.length > 0 && lastVoicedTs !== null && f.timestampMs - lastVoicedTs >= cfg.gapMs) {
        flush();
      }
      continue;
    }

    if (group.length > 0) {
      const gapExceeded = lastVoicedTs !== null && f.timestampMs - lastVoicedTs >= cfg.gapMs;
      const pitchChanged = midiFromHz(f.hz) !== midiFromHz(group[0].hz);
      if (gapExceeded || pitchChanged) {
        flush();
      }
    }
    group.push(f);
    lastVoicedTs = f.timestampMs;
  }
  flush();

  return notes;
}
