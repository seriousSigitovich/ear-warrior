import { localGrader, serverGrader, toAttemptGrade } from '../../../src/features/practice/grader';
import { DEFAULT_GRADING_CFG } from '../../../src/services/grading/grade';
import { parseResult } from '../../../src/services/rewards/client';
import type { CheckOutcome } from '../../../src/services/rewards/types';
import type { DetectedNote, Melody } from '../../../src/models';
import { checkBody } from '../rewards/fixtures';

const det = (midi: number, index: number): DetectedNote => ({
  index,
  midi,
  frequencyHz: 0,
  centsOffset: 0,
  clarity: 1,
  startMs: index,
  endMs: index + 1,
});
const melody = (id: string, midis: number[]): Melody => ({
  id,
  difficultyId: 'L1',
  scale: '',
  tempoBpm: 100,
  createdAt: '',
  phrases: [midis.length],
  notes: midis.map((midi, index) => ({
    index,
    midi,
    noteName: '',
    frequencyHz: 0,
    centsOffset: 0,
    durationBeats: 1,
  })),
});

describe('toAttemptGrade', () => {
  it("carries the server's verdict and notes; a fretboard tap has full clarity; no taps is a timeout", () => {
    const g = parseResult(checkBody(), '2026-11-16')!.grade;
    expect(toAttemptGrade(g, 3)).toEqual({
      noteResults: g.noteResults,
      verdict: 'correct',
      confidence: 1,
      lowConfidence: false,
      timedOut: false,
    });
    expect(toAttemptGrade(g, 0).timedOut).toBe(true);
  });
});

describe('server grader', () => {
  const result = parseResult(checkBody(), '2026-11-16')!;
  const rewards = (out: CheckOutcome) => ({
    check: jest.fn(async () => out),
    hint: jest.fn(async () => 64),
    answer: jest.fn(async () => [64, 62]),
    onResult: jest.fn(() => () => undefined),
  });

  it('sends the tune, the phrase and only the midi of the taps — never the answer', async () => {
    const r = rewards({ kind: 'graded', result });
    const out = await serverGrader(r).check({
      melody: melody('mary-7', [0, 0]),
      phraseIndex: 1,
      phrase: melody('mary-7', [0, 0]),
      detected: [det(64, 0), det(62, 1)],
    });
    expect(r.check).toHaveBeenCalledWith({ tuneId: 'mary', phrase: 1, played: [64, 62] });
    expect(out).toMatchObject({ kind: 'graded', reward: result });
  });

  it('passes a queued or rejected check through', async () => {
    const req = {
      melody: melody('mary-7', [0]),
      phraseIndex: 0,
      phrase: melody('mary-7', [0]),
      detected: [det(64, 0)],
    };
    expect(await serverGrader(rewards({ kind: 'queued', checkId: 'c1' })).check(req)).toEqual({
      kind: 'queued',
      checkId: 'c1',
    });
    expect(await serverGrader(rewards({ kind: 'rejected' })).check(req)).toEqual({
      kind: 'rejected',
    });
  });

  it('asks the server for the hint and the answer by tune and phrase, and turns a late answer into a grade', async () => {
    const r = rewards({ kind: 'queued', checkId: 'c1' });
    const g = serverGrader(r);
    expect(await g.firstNote(melody('mary-7', [0]), 1, melody('mary-7', [0]))).toBe(64);
    expect(r.hint).toHaveBeenCalledWith('mary', 1);
    expect(await g.answer(melody('mary-7', [0]), 0, melody('mary-7', [0]))).toEqual([64, 62]);
    const seen: unknown[] = [];
    r.onResult.mockImplementation(((cb: (id: string, res: typeof result) => void) => {
      cb('c1', result);
      return () => undefined;
    }) as never);
    g.onAnswered!((id, out) => seen.push([id, out.grade.verdict, out.reward?.payout.xp]));
    expect(seen).toEqual([['c1', 'correct', 20]]);
  });
});

describe('server grader on a tune whose answer the app holds (the first levels)', () => {
  const pitched = (midis: number[]) => melody('mary-7', midis);
  const result = parseResult(checkBody(), '2026-11-16')!;
  const setup = (out: CheckOutcome) => {
    const listeners: ((id: string, r: typeof result) => void)[] = [];
    const rewards = {
      check: jest.fn(async () => out),
      hint: jest.fn(async () => 99),
      answer: jest.fn(async () => [99]),
      onResult: jest.fn((l: (id: string, r: typeof result) => void) => {
        listeners.push(l);
        return () => listeners.splice(listeners.indexOf(l), 1);
      }),
    };
    return { rewards, listeners, grader: serverGrader(rewards) };
  };
  const req = (answer: number[], played: number[]) => ({
    melody: pitched(answer),
    phraseIndex: 1,
    phrase: pitched(answer),
    detected: played.map(det),
  });

  it('grades on the device at once — before the server has answered — and still sends the check', async () => {
    let release!: (o: CheckOutcome) => void;
    const slow = new Promise<CheckOutcome>((r) => (release = r));
    const { rewards, grader } = setup({ kind: 'queued', checkId: 'x' });
    rewards.check.mockImplementation(() => slow);
    const out = await grader.check(req([64, 62, 60], [64, 62, 60]));
    expect(out).toMatchObject({ kind: 'graded', grade: { verdict: 'correct' } });
    expect(out.kind === 'graded' && out.reward).toBeUndefined();
    expect(rewards.check).toHaveBeenCalledWith({ tuneId: 'mary', phrase: 1, played: [64, 62, 60] });
    release({ kind: 'queued', checkId: 'x' });
  });

  it('shows a wrong answer as wrong without waiting for anyone', async () => {
    const out = await setup({ kind: 'queued', checkId: 'x' }).grader.check(
      req([64, 62, 60], [64, 65, 60]),
    );
    expect(out.kind === 'graded' && out.grade.verdict).toBe('incorrect');
  });

  it('hands the server’s payout over when it arrives', async () => {
    const { grader } = setup({ kind: 'graded', result });
    const late: unknown[] = [];
    grader.onReward!((l) => late.push([l.melodyId, l.level, l.phraseIndex, l.reward.payout.xp]));
    await grader.check(req([64, 62, 60], [64, 62, 60]));
    await Promise.resolve();
    await Promise.resolve();
    expect(late).toEqual([['mary-7', 'L1', 1, 20]]);
  });

  it('with no network the payout comes when the queued check is finally sent — and is not mistaken for a waiting phrase', async () => {
    const { grader, listeners } = setup({ kind: 'queued', checkId: 'q1' });
    const rewardsSeen: unknown[] = [];
    const answered: unknown[] = [];
    grader.onReward!((l) => rewardsSeen.push(l.reward.payout.xp));
    grader.onAnswered!((id) => answered.push(id));
    await grader.check(req([64, 62, 60], [64, 62, 60]));
    await Promise.resolve();
    await Promise.resolve();
    listeners.forEach((l) => l('q1', result));
    expect(rewardsSeen).toEqual([20]);
    expect(answered).toEqual([]);
  });

  it('serves the hint and the answer from the notes it holds, and still tells the server (it halves or voids the payout)', async () => {
    const { rewards, grader } = setup({ kind: 'queued', checkId: 'x' });
    const m = pitched([64, 62, 60]);
    expect(await grader.firstNote(m, 1, m)).toBe(64);
    expect(await grader.answer(m, 1, m)).toEqual([64, 62, 60]);
    expect(rewards.hint).toHaveBeenCalledWith('mary', 1);
    expect(rewards.answer).toHaveBeenCalledWith('mary', 1);
  });

  it('a tune without pitches still goes to the server alone', async () => {
    const { rewards, grader } = setup({ kind: 'graded', result });
    const none = melody('hard-1', [0, 0, 0]);
    const out = await grader.check({
      melody: none,
      phraseIndex: 0,
      phrase: none,
      detected: [det(64, 0)],
    });
    expect(out).toMatchObject({ kind: 'graded', reward: result });
    expect(await grader.firstNote(none, 0, none)).toBe(99);
    expect(rewards.hint).toHaveBeenCalled();
  });
});

describe('local grader (the first melody)', () => {
  const phrase = melody('fifthfirst-first', [55, 55, 55, 51]);
  it('grades against the notes it holds and pays nothing', async () => {
    const out = await localGrader(DEFAULT_GRADING_CFG).check({
      melody: phrase,
      phraseIndex: 0,
      phrase,
      detected: [55, 55, 55, 51].map(det),
    });
    expect(out.kind).toBe('graded');
    if (out.kind === 'graded') {
      expect(out.grade.verdict).toBe('correct');
      expect(out.reward).toBeUndefined();
    }
    const wrong = await localGrader(DEFAULT_GRADING_CFG).check({
      melody: phrase,
      phraseIndex: 0,
      phrase,
      detected: [55, 55, 56, 51].map(det),
    });
    expect(wrong.kind === 'graded' && wrong.grade.verdict).toBe('incorrect');
  });
  it('knows the first note and the whole phrase', async () => {
    const g = localGrader(DEFAULT_GRADING_CFG);
    expect(await g.firstNote(phrase, 0, phrase)).toBe(55);
    expect(await g.answer(phrase, 0, phrase)).toEqual([55, 55, 55, 51]);
  });
});
