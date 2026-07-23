import { Melody } from '../../src/models';
import { hzFromMidi, noteName } from '../../src/lib/pitchNote';
import { scheduleMelody } from '../../src/lib/schedule';
import { NativePlayer, createAudioPlayback } from '../../src/services/audio/playback';

function melody(midis: number[]): Melody {
  return {
    id: 'm',
    difficultyId: 'L1',
    scale: 'C_major',
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

function fakePlayer() {
  const played: { midi: number; durationMs: number }[] = [];
  let stops = 0;
  const native: NativePlayer = {
    async playTone(midi, durationMs) {
      played.push({ midi, durationMs });
    },
    async preloadTones() {},
    async stopAll() {
      stops++;
    },
  };
  return { native, played, stops: () => stops };
}

describe('audio playback (contracts/audio-playback.md)', () => {
  test('plays the correct note per midi, in order, resolving after the last note', async () => {
    const f = fakePlayer();
    const pb = createAudioPlayback(f.native);
    await pb.playMelody(scheduleMelody(melody([64, 67, 69]), 120));
    expect(f.played.map((p) => p.midi)).toEqual([64, 67, 69]);
  });

  test('preload throws on an out-of-range note (never partial playback)', async () => {
    const pb = createAudioPlayback(fakePlayer().native);
    await expect(pb.preload([200])).rejects.toThrow();
  });

  test('playReferenceTone plays the tuning tone for a note', async () => {
    const f = fakePlayer();
    await createAudioPlayback(f.native).playReferenceTone(64);
    expect(f.played).toEqual([{ midi: 64, durationMs: 1500 }]);
  });

  test('stop is idempotent', async () => {
    const f = fakePlayer();
    const pb = createAudioPlayback(f.native);
    await pb.stop();
    await pb.stop();
    expect(f.stops()).toBe(2); // safe to call repeatedly
  });
});
