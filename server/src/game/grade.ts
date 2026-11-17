// Grades one answered phrase against its stored answer (spec 024, FR-006). The same best-fit alignment as the
// app's grader (src/services/grading/grade.ts, now only used for draft mode): a played note is `matched` when it
// aligns to an answer note of the same pitch, so one wrong, missed or extra note does not cascade. Both are
// checked against grade.fixtures.json (tests/unit/graderParity.test.ts in the app) so they cannot drift.
// Pure and deterministic; works on midi lists, because only pitch and order count.
import { PASS_ACCURACY } from './config.js';

export type NoteStatus = 'matched' | 'wrong' | 'missed' | 'extra';

export interface NoteResult {
  status: NoteStatus;
  /** Index in the answer; null for an extra played note. */
  targetIndex: number | null;
  expectedMidi: number | null;
  detectedMidi: number | null;
}

export interface PhraseGrade {
  noteResults: NoteResult[];
  /** Matched answer notes as a percentage of the answer's notes (extras do not lower it), 0–100. */
  accuracy: number;
  passed: boolean;
}

export function gradePhrase(answer: readonly number[], played: readonly number[]): PhraseGrade {
  const n = answer.length;
  const m = played.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  const cost = (i: number, j: number) => (answer[i - 1] === played[j - 1] ? 0 : 1);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = Math.min(dp[i - 1][j - 1] + cost(i, j), dp[i - 1][j] + 1, dp[i][j - 1] + 1);
    }
  }

  const reversed: NoteResult[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    let move: 'diag' | 'up' | 'left';
    if (i > 0 && j > 0) {
      if (dp[i][j] === dp[i - 1][j - 1] + cost(i, j)) move = 'diag';
      else if (dp[i][j] === dp[i - 1][j] + 1) move = 'up';
      else move = 'left';
    } else if (i > 0) move = 'up';
    else move = 'left';

    if (move === 'diag') {
      reversed.push({
        status: answer[i - 1] === played[j - 1] ? 'matched' : 'wrong',
        targetIndex: i - 1,
        expectedMidi: answer[i - 1],
        detectedMidi: played[j - 1],
      });
      i--;
      j--;
    } else if (move === 'up') {
      reversed.push({ status: 'missed', targetIndex: i - 1, expectedMidi: answer[i - 1], detectedMidi: null });
      i--;
    } else {
      reversed.push({ status: 'extra', targetIndex: null, expectedMidi: null, detectedMidi: played[j - 1] });
      j--;
    }
  }
  const noteResults = reversed.reverse();
  const matched = noteResults.filter((r) => r.status === 'matched').length;
  const accuracy = n === 0 ? 0 : Math.round((matched / n) * 100);
  return { noteResults, accuracy, passed: accuracy >= PASS_ACCURACY };
}
