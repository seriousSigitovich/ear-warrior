import { Melody } from '../../../src/models';
import { hzFromMidi, noteName } from '../../../src/lib/pitchNote';
import { beatMs, scheduleMelody, totalDurationMs } from '../../../src/lib/schedule';

function melody(midis: number[]): Melody {
  return {
    id: 'm',
    difficultyId: 'L1',
    scale: 'C_major_pentatonic',
    createdAt: '',
    notes: midis.map((midi, index) => ({
      index,
      midi,
      noteName: noteName(midi),
      frequencyHz: hzFromMidi(midi),
      centsOffset: 0,
      durationBeats: 1,
    })),
  };
}

describe('playback scheduling math (audio-playback contract)', () => {
  test('beatMs converts BPM to ms/beat', () => {
    expect(beatMs(60)).toBe(1000);
    expect(beatMs(120)).toBe(500);
  });

  test('schedules notes back-to-back by beat duration', () => {
    const scheduled = scheduleMelody(melody([64, 67, 69]), 60);
    expect(scheduled.notes.map((n) => n.startMs)).toEqual([0, 1000, 2000]);
    expect(scheduled.notes.every((n) => n.durationMs === 1000)).toBe(true);
  });

  test('is deterministic: same melody + tempo → identical timing (US1 scenario 4)', () => {
    const m = melody([64, 67, 69]);
    expect(scheduleMelody(m, 90)).toEqual(scheduleMelody(m, 90));
  });

  test('total duration spans all notes', () => {
    expect(totalDurationMs(scheduleMelody(melody([64, 67, 69]), 60))).toBe(3000);
  });
});
