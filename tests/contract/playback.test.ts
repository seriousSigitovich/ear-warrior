import { Melody } from '../../src/models';
import { hzFromMidi, noteName } from '../../src/lib/pitchNote';
import { scheduleMelody } from '../../src/lib/schedule';
import { NativePlayer, createAudioPlayback } from '../../src/services/audio/playback';

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

function fakePlayer() {
  const played: { file: string; durationMs: number }[] = [];
  let stops = 0;
  const native: NativePlayer = {
    async playSample(file, durationMs) {
      played.push({ file, durationMs });
    },
    async preloadSamples() {},
    async stopAll() {
      stops++;
    },
  };
  return { native, played, stops: () => stops };
}

describe('audio playback (contracts/audio-playback.md)', () => {
  test('plays the correct sample per midi, in order, resolving after the last note', async () => {
    const f = fakePlayer();
    const pb = createAudioPlayback(f.native);
    await pb.playMelody(scheduleMelody(melody([64, 67, 69]), 120));
    expect(f.played.map((p) => p.file)).toEqual(['e4.mp3', 'g4.mp3', 'a4.mp3']);
  });

  test('preload throws on a missing sample (never partial playback)', async () => {
    const pb = createAudioPlayback(fakePlayer().native);
    await expect(pb.preload([200])).rejects.toThrow();
  });

  test('playReferenceTone plays the tuning tone for a note', async () => {
    const f = fakePlayer();
    await createAudioPlayback(f.native).playReferenceTone(64);
    expect(f.played).toEqual([{ file: 'e4.mp3', durationMs: 1500 }]);
  });

  test('stop is idempotent', async () => {
    const f = fakePlayer();
    const pb = createAudioPlayback(f.native);
    await pb.stop();
    await pb.stop();
    expect(f.stops()).toBe(2); // safe to call repeatedly
  });
});
