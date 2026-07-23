// Systematic-detune detection (FR-014, contracts/tuning-check.md). Pure rule over an attempt's
// detected notes: warn only on a *systematic* offset (median cents beyond threshold, mostly one
// direction), never on a single sharp/flat note or scattered intonation. Thresholds are calibratable.
import { DetectedNote, TuningConfig, TuningWarning } from '../models';

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function detectConsistentDetune(detected: DetectedNote[], cfg: TuningConfig): TuningWarning {
  if (detected.length < cfg.minNotes) {
    return { outOfTune: false, medianCents: 0, direction: 'none' };
  }

  const offsets = detected.map((n) => n.centsOffset);
  const medianCents = median(offsets);
  const sign = Math.sign(medianCents);
  const sameDirection = offsets.filter((c) => Math.sign(c) === sign && sign !== 0).length;
  const majoritySameDirection = sameDirection > detected.length / 2;

  const outOfTune = Math.abs(medianCents) > cfg.centsThreshold && majoritySameDirection;

  return {
    outOfTune,
    medianCents,
    direction: outOfTune ? (medianCents > 0 ? 'sharp' : 'flat') : 'none',
  };
}
