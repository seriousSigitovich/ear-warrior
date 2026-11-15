import { NoteResult } from '../../../src/models';
import { beatLine, lastResultOf, whenLabel } from '../../../src/lib/lastResult';

const note = (i: number, status: NoteResult['status'], midi = 64): NoteResult => ({
  targetIndex: i,
  status,
  expectedMidi: midi,
  detectedMidi: status === 'missed' ? null : midi,
  octaveMismatch: false,
});

const today = '2026-11-15';
// Local noon, so the local day is the same everywhere the tests run.
const at = (day: string) => new Date(`${day}T12:00:00`).toISOString();

describe('how long ago', () => {
  test('today, yesterday, then days', () => {
    expect(whenLabel('2026-11-15', today)).toBe('today');
    expect(whenLabel('2026-11-14', today)).toBe('yesterday');
    expect(whenLabel('2026-11-12', today)).toBe('3 days ago');
  });
});

describe('the line under the result', () => {
  test('praise for a clean one, a nudge when it was close, an invitation otherwise', () => {
    expect(beatLine(8, 8)).toBe('Clean. Try the next one.');
    expect(beatLine(6, 8)).toBe('2 to go. Beat it.');
    expect(beatLine(7, 8)).toBe('1 to go. Beat it.');
    expect(beatLine(3, 8)).toBe('Another go will lock it in.');
    expect(beatLine(0, 0)).toBe('');
  });
});

describe('the last result Home shows', () => {
  const phrase = [note(0, 'matched', 64), note(1, 'wrong', 62), note(2, 'missed', 60)];

  test('a phrase: its score, its notes by name in order, how long ago, and a line', () => {
    const r = lastResultOf('Last phrase', phrase, at('2026-11-14'), today);
    expect(r).toMatchObject({
      kind: 'Last phrase',
      when: 'yesterday',
      matched: 1,
      total: 3,
      hidden: 0,
      line: '2 to go. Beat it.',
    });
    expect(r?.notes).toEqual([
      { name: 'E', state: 'matched' },
      { name: 'D', state: 'wrong' },
      { name: 'C', state: 'missed' },
    ]);
  });

  test('a finished attempt is told apart by its kind', () => {
    expect(lastResultOf('Last attempt', phrase, at('2026-11-13'), today)?.kind).toBe(
      'Last attempt',
    );
  });

  test('nothing to show for a result with no notes', () => {
    expect(lastResultOf('Last attempt', [], at('2026-11-13'), today)).toBeNull();
  });

  test('a long result shows the first sixteen notes and counts the rest; extras are not notes', () => {
    const many = Array.from({ length: 20 }, (_, i) => note(i, 'matched'));
    const extra: NoteResult = { ...note(0, 'extra'), targetIndex: null };
    const r = lastResultOf('Last attempt', [...many, extra], at('2026-11-15'), today);
    expect(r?.total).toBe(20);
    expect(r?.notes).toHaveLength(16);
    expect(r?.hidden).toBe(4);
  });

  test("the notes are in the tune's own order, however the results came", () => {
    const r = lastResultOf(
      'Last phrase',
      [note(2, 'missed', 60), note(0, 'matched', 64), note(1, 'wrong', 62)],
      at('2026-11-15'),
      today,
    );
    expect(r?.notes.map((n) => n.name)).toEqual(['E', 'D', 'C']);
  });
});
