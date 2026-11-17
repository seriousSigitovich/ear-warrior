// The app's grader and the server's grader (server/src/game/grade.ts) must agree: both run the same fixtures.
import { readFileSync } from 'fs';
import { join } from 'path';
import { DEFAULT_GRADING_CFG, gradeAttempt } from '../../src/services/grading/grade';

interface Fixture {
  name: string;
  answer: number[];
  played: number[];
  expected: {
    results: {
      status: string;
      targetIndex: number | null;
      expectedMidi: number | null;
      detectedMidi: number | null;
    }[];
  };
}
const fixtures: Fixture[] = JSON.parse(
  readFileSync(join(__dirname, '../../server/src/game/grade.fixtures.json'), 'utf8'),
);

describe('grader parity with the server', () => {
  for (const f of fixtures) {
    it(f.name, () => {
      const target = { notes: f.answer.map((midi, index) => ({ index, midi })) } as never;
      const detected = f.played.map((midi, index) => ({
        index,
        midi,
        frequencyHz: 0,
        centsOffset: 0,
        clarity: 1,
        startMs: index,
        endMs: index + 1,
      }));
      const got = gradeAttempt(target, detected, DEFAULT_GRADING_CFG).noteResults.map((r) => ({
        status: r.status,
        targetIndex: r.targetIndex,
        expectedMidi: r.expectedMidi,
        detectedMidi: r.detectedMidi,
      }));
      expect(got).toEqual(f.expected.results);
    });
  }
});
