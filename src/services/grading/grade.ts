// Grading engine (FR-005, FR-016, FR-017): compare a captured attempt to the target melody with
// best-fit sequence alignment (edit distance / LCS), classify each note (matched | wrong | missed |
// extra) without cascading a single insertion/omission, and derive verdict + confidence.
// Pure and deterministic — no IO. This is the correctness core of the product.
import {
  AttemptGrade,
  DetectedNote,
  GradingConfig,
  Melody,
  Note,
  NoteResult,
} from '../../models';
import { pitchClass } from '../../lib/pitchNote';

type Move = 'diag' | 'up' | 'left';

function notesMatch(target: Note, detected: DetectedNote, cfg: GradingConfig): boolean {
  return cfg.octaveSensitive
    ? target.midi === detected.midi
    : pitchClass(target.midi) === pitchClass(detected.midi);
}

/**
 * Grade one attempt against its target melody.
 * A played note is `matched` iff it aligns to a target note of the same pitch (within the fixed
 * ±50-cent nearest-note quantization already applied by the detector). Confidence is the minimum
 * per-note clarity across the attempt (FR-017).
 */
export function gradeAttempt(
  target: Melody,
  detected: DetectedNote[],
  cfg: GradingConfig,
): AttemptGrade {
  const t = target.notes;
  const d = detected;
  const n = t.length;
  const m = d.length;

  // Edit-distance DP: dp[i][j] = min cost aligning t[0..i) with d[0..j).
  // Aligned mismatch costs 1 (a `wrong`), an unaligned target/played note costs 1 (missed/extra),
  // so a single wrong note is preferred over a missed+extra pair.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const subCost = notesMatch(t[i - 1], d[j - 1], cfg) ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j - 1] + subCost, dp[i - 1][j] + 1, dp[i][j - 1] + 1);
    }
  }

  // Backtrace (diagonal-first on an exact/aligned pair) to per-note results.
  const reversed: NoteResult[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    let move: Move;
    if (i > 0 && j > 0) {
      const subCost = notesMatch(t[i - 1], d[j - 1], cfg) ? 0 : 1;
      if (dp[i][j] === dp[i - 1][j - 1] + subCost) move = 'diag';
      else if (dp[i][j] === dp[i - 1][j] + 1) move = 'up';
      else move = 'left';
    } else if (i > 0) {
      move = 'up';
    } else {
      move = 'left';
    }

    if (move === 'diag') {
      const target = t[i - 1];
      const played = d[j - 1];
      const matched = notesMatch(target, played, cfg);
      reversed.push({
        targetIndex: target.index,
        status: matched ? 'matched' : 'wrong',
        expectedMidi: target.midi,
        detectedMidi: played.midi,
        octaveMismatch:
          !matched && pitchClass(target.midi) === pitchClass(played.midi) && target.midi !== played.midi,
      });
      i--;
      j--;
    } else if (move === 'up') {
      const target = t[i - 1];
      reversed.push({
        targetIndex: target.index,
        status: 'missed',
        expectedMidi: target.midi,
        detectedMidi: null,
        octaveMismatch: false,
      });
      i--;
    } else {
      const played = d[j - 1];
      reversed.push({
        targetIndex: null,
        status: 'extra',
        expectedMidi: null,
        detectedMidi: played.midi,
        octaveMismatch: false,
      });
      j--;
    }
  }
  const noteResults = reversed.reverse();

  const matchedCount = noteResults.filter((r) => r.status === 'matched').length;
  const extraCount = noteResults.filter((r) => r.status === 'extra').length;
  const verdict = matchedCount === n && extraCount === 0 ? 'correct' : 'incorrect';

  const confidence = m === 0 ? 0 : Math.min(...d.map((note) => note.clarity));

  return {
    noteResults,
    verdict,
    confidence,
    lowConfidence: confidence < cfg.lowConfidenceThreshold,
    timedOut: m === 0,
  };
}
