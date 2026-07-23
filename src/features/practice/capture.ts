// Capture control (T029, FR-015): collect pitch frames for one attempt, ending by silence.
// Two silence thresholds (FR-004/FR-015): the segmenter uses a short inter-note gap, while capture
// ends the attempt only after the longer end-of-attempt silence — so hesitant pauses are not cut off.
// Times out with no input after the "your turn" cue. Timing values are calibratable.
import { PitchFrame } from '../../models';
import { PitchDetectionConfig, PitchDetector } from '../../services/audio/pitch';

export interface CaptureConfig {
  /** No playing at all after the cue → time out (~8 s, FR-015). */
  noInputTimeoutMs: number;
  /** Silence after the last detected note that ends a started attempt (~2 s, FR-015). */
  endSilenceMs: number;
}

export interface CaptureResult {
  frames: PitchFrame[];
  timedOut: boolean;
}

/**
 * Run one capture window over a pitch detector, resolving when the attempt ends by silence or times
 * out. Pure orchestration around the injected detector; the actual audio IO lives in the detector.
 */
export function runCapture(
  detector: PitchDetector,
  pitchCfg: PitchDetectionConfig,
  cfg: CaptureConfig,
): Promise<CaptureResult> {
  return new Promise<CaptureResult>((resolve, reject) => {
    const frames: PitchFrame[] = [];
    let started = false;
    let noInputTimer: ReturnType<typeof setTimeout>;
    let endTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = async (timedOut: boolean) => {
      clearTimeout(noInputTimer);
      if (endTimer) clearTimeout(endTimer);
      await detector.stop();
      resolve({ frames, timedOut });
    };

    const isVoiced = (f: PitchFrame) =>
      f.hz >= pitchCfg.minHz && f.hz <= pitchCfg.maxHz && f.clarity >= pitchCfg.clarityThreshold;

    noInputTimer = setTimeout(() => {
      if (!started) void finish(true); // never started playing → timeout (FR-015)
    }, cfg.noInputTimeoutMs);

    detector
      .start(pitchCfg, (frame) => {
        frames.push(frame);
        if (isVoiced(frame)) {
          started = true;
          clearTimeout(noInputTimer);
          if (endTimer) clearTimeout(endTimer);
          // Restart the end-of-attempt silence timer on every voiced frame.
          endTimer = setTimeout(() => void finish(false), cfg.endSilenceMs);
        }
      })
      .catch(reject);
  });
}
