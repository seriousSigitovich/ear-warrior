// Adaptive voicing threshold (Tier 1 noise robustness). Pure, no IO — directly unit-testable.
//
// The problem: a fixed clarity gate (e.g. 0.5) assumes a quiet room and a loud source. In a noisy
// room a real note's clarity may not clear the gate (times out / drops notes); in a very quiet room a
// weak source may sit just under it. The fix: set the gate RELATIVE to the room's measured ambient
// clarity. Every capture window already contains ambient frames — the pre-onset lead-in and the ~2 s
// silent tail after the last note (see capture.ts) — so we can estimate the floor from the frames
// themselves, per attempt, without any extra recording step.
import { CalibrationConfig, PitchFrame } from '../models';

/** Sensible defaults; hardMin/hardMax straddle the old fixed 0.5 so the fallback == today's behavior. */
export const DEFAULT_CALIBRATION_CONFIG: CalibrationConfig = {
  ambientPercentile: 0.2,
  margin: 0.15,
  hardMin: 0.3,
  hardMax: 0.7,
  minFrames: 20,
};

/** Nearest-rank percentile (p in [0,1]) over `values`. Empty → 0. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[idx];
}

/**
 * The clarity level that represents "quiet" for this capture: a low percentile of every frame's
 * clarity. Robust because captures are padded with silence (pre-onset + the end-of-attempt tail), so
 * the low percentile lands in the ambient band rather than on the played note.
 */
export function estimateAmbientClarity(frames: PitchFrame[], cfg: CalibrationConfig): number {
  return percentile(
    frames.map((f) => f.clarity),
    cfg.ambientPercentile,
  );
}

/**
 * Adaptive voicing threshold = clamp(ambient + margin, hardMin, hardMax). With too few frames to
 * trust the estimate, fall back to the midpoint of the clamp band — which, with the default
 * hardMin/hardMax (0.3/0.7), equals the previous fixed threshold (0.5), so behavior degrades safely.
 */
export function adaptiveClarityThreshold(frames: PitchFrame[], cfg: CalibrationConfig): number {
  if (frames.length < cfg.minFrames) {
    return (cfg.hardMin + cfg.hardMax) / 2;
  }
  const ambient = estimateAmbientClarity(frames, cfg);
  const raised = ambient + cfg.margin;
  return Math.min(cfg.hardMax, Math.max(cfg.hardMin, raised));
}
