// Who grades a phrase (spec 024). The server always has the last word on XP: the app sends the notes the learner tapped
// and shows what comes back. For a tune of the first levels the app also holds the answer, so a new learner gets the
// result at once, offline, and the server's payout follows when it can be reached. Every other tune is graded by the
// server alone. The one tune graded only on the device is the coached first melody, which pays nothing. The practice
// loop only sees this interface.
import type { AttemptGrade, DetectedNote, GradingConfig, Melody } from '../../models';
import { DEFAULT_GRADING_CFG, gradeAttempt } from '../../services/grading/grade';
import type { RewardsService } from '../../services/rewards/service';
import type { GradeView, PhraseResult } from '../../services/rewards/types';
import { tuneIdOf } from '../../services/melody/curated';

export interface GradeRequest {
  melody: Melody;
  phraseIndex: number;
  /** The phrase as a melody of its own (its notes' lengths; pitches only for the first melody). */
  phrase: Melody;
  detected: DetectedNote[];
}

export type GradedOutcome = { kind: 'graded'; grade: AttemptGrade; reward?: PhraseResult };

export type GraderOutcome =
  | GradedOutcome
  /** The server could not be reached: the check is kept and answered later through `onAnswered`. */
  | { kind: 'queued'; checkId: string }
  /** The server will never accept this check. */
  | { kind: 'rejected' };

/** What the server paid for a phrase the app had already graded itself; it arrives after the result was shown. */
export interface LateReward {
  melodyId: string;
  /** The tune's level id (`L1`…), as on the melody. */
  level: string;
  phraseIndex: number;
  reward: PhraseResult;
}

export interface PhraseGrader {
  check(req: GradeRequest): Promise<GraderOutcome>;
  /** A queued check was answered (possibly after its screen state moved on). Returns the unsubscribe. */
  onAnswered?(listener: (checkId: string, outcome: GradedOutcome) => void): () => void;
  /** The server's payout for a phrase the app graded itself, once it arrives (`check` returned no `reward`). */
  onReward?(listener: (late: LateReward) => void): () => void;
  /** The midi of the phrase's first note (a hint); null when it cannot be had. */
  firstNote(melody: Melody, phraseIndex: number, phrase: Melody): Promise<number | null>;
  /** The midi of the whole phrase (show answer); null when it cannot be had. */
  answer(melody: Melody, phraseIndex: number, phrase: Melody): Promise<number[] | null>;
}

/** The server's grade as the loop's grade: a fretboard tap has full clarity, and an empty answer is a timeout. */
export function toAttemptGrade(g: GradeView, tapCount: number): AttemptGrade {
  return {
    noteResults: g.noteResults,
    verdict: g.verdict,
    confidence: 1,
    lowConfidence: false,
    timedOut: tapCount === 0,
  };
}

/** The phrase's notes are known to the app (a tune of the first levels): it can grade it itself. */
const hasAnswer = (phrase: Melody): boolean =>
  phrase.notes.length > 0 && phrase.notes.every((n) => n.midi > 0);

/**
 * The server grades and pays; the app queues what it cannot send. A phrase whose answer the app holds is also graded on
 * the device, so its result shows at once: the same check still goes to the server, whose payout arrives via `onReward`.
 */
export function serverGrader(
  rewards: Pick<RewardsService, 'check' | 'hint' | 'answer' | 'onResult'>,
  cfg: GradingConfig = DEFAULT_GRADING_CFG,
): PhraseGrader {
  /** Checks the app graded itself that the server could not be asked yet, by id: their payout comes later. */
  /** Ids of every check the app graded itself that the server could not be asked for yet: never a phrase to wait on. */
  const gradedHere = new Set<string>();
  const waitingForReward = new Map<
    string,
    { melodyId: string; level: string; phraseIndex: number }
  >();
  const rewardListeners = new Set<(late: LateReward) => void>();
  const emit = (late: LateReward) => [...rewardListeners].forEach((l) => l(late));

  return {
    async check({ melody, phraseIndex, phrase, detected }) {
      const sent = rewards.check({
        tuneId: tuneIdOf(melody.id),
        phrase: phraseIndex,
        played: detected.map((d) => d.midi),
      });
      if (!hasAnswer(phrase)) {
        const out = await sent;
        if (out.kind === 'graded')
          return {
            kind: 'graded',
            grade: toAttemptGrade(out.result.grade, detected.length),
            reward: out.result,
          };
        return out;
      }
      // Graded here and now; the payout is the server's and follows.
      const grade = gradeAttempt(phrase, detected, cfg);
      void sent.then((out) => {
        const at = { melodyId: melody.id, level: melody.difficultyId, phraseIndex };
        if (out.kind === 'graded') emit({ ...at, reward: out.result });
        else if (out.kind === 'queued') {
          waitingForReward.set(out.checkId, at);
          gradedHere.add(out.checkId);
        }
      });
      return { kind: 'graded', grade };
    },
    onAnswered(listener) {
      return rewards.onResult((checkId, result) => {
        if (!gradedHere.has(checkId))
          listener(checkId, {
            kind: 'graded',
            grade: toAttemptGrade(result.grade, 1),
            reward: result,
          });
      });
    },
    onReward(listener) {
      rewardListeners.add(listener);
      const unsubscribe = rewards.onResult((checkId, result) => {
        const at = waitingForReward.get(checkId);
        if (!at) return;
        waitingForReward.delete(checkId);
        emit({ ...at, reward: result });
      });
      return () => {
        rewardListeners.delete(listener);
        unsubscribe();
      };
    },
    async firstNote(melody, phraseIndex, phrase) {
      if (!hasAnswer(phrase)) return rewards.hint(tuneIdOf(melody.id), phraseIndex);
      void rewards.hint(tuneIdOf(melody.id), phraseIndex); // the server records the help (it halves the payout); the note is known here
      return phrase.notes[0].midi;
    },
    async answer(melody, phraseIndex, phrase) {
      if (!hasAnswer(phrase)) return rewards.answer(tuneIdOf(melody.id), phraseIndex);
      void rewards.answer(tuneIdOf(melody.id), phraseIndex); // recorded by the server: the phrase then pays nothing
      return phrase.notes.map((n) => n.midi);
    },
  };
}

/** The device grades, against notes it holds (the first melody only). Pays nothing. */
export function localGrader(cfg: GradingConfig): PhraseGrader {
  return {
    async check({ phrase, detected }) {
      return { kind: 'graded', grade: gradeAttempt(phrase, detected, cfg) };
    },
    async firstNote(_melody, _i, phrase) {
      return phrase.notes[0]?.midi ?? null;
    },
    async answer(_melody, _i, phrase) {
      return phrase.notes.map((n) => n.midi);
    },
  };
}
