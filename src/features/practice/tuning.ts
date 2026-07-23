// Tuning-check wiring (T030, FR-014). Runs the pure detune rule over the captured notes and, when a
// systematic offset is found, surfaces an ADVISORY warning + reference tone. Non-blocking: the learner
// may dismiss it and proceed to grading (clarification 2026-07-23).
import { DetectedNote, TuningConfig, TuningWarning } from '../../models';
import { detectConsistentDetune } from '../../lib/tuning';
import { AudioPlayback } from '../../services/audio/playback';

export interface TuningCheck extends TuningWarning {
  /** Play a standard-tuning reference tone (E-A-D-G-B-E open strings map to these MIDI notes). */
  playReference: (midi: number) => Promise<void>;
}

/** Open-string reference notes for standard tuning E-A-D-G-B-E. */
export const STANDARD_TUNING_MIDI = [40, 45, 50, 55, 59, 64];

export function evaluateTuning(
  detected: DetectedNote[],
  playback: AudioPlayback,
  cfg: TuningConfig = { centsThreshold: 35, minNotes: 3 },
): TuningCheck {
  const warning = detectConsistentDetune(detected, cfg);
  return {
    ...warning,
    playReference: (midi: number) => playback.playReferenceTone(midi),
  };
}
