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

function fakePlayer(clips: string[] = []) {
  const played: { midi: number; durationMs: number }[] = [];
  const playedClips: { clipId: string; durationMs: number }[] = [];
  let stops = 0;
  const native: NativePlayer = {
    async playTone(midi, durationMs) {
      played.push({ midi, durationMs });
    },
    async playClip(clipId, durationMs) {
      if (!clips.includes(clipId)) return false;
      playedClips.push({ clipId, durationMs });
      return true;
    },
    async preloadTones() {},
    async stopAll() {
      stops++;
    },
  };
  return { native, played, playedClips, stops: () => stops };
}

describe('audio playback (contracts/audio-playback.md)', () => {
  test('plays the correct note per midi, in order, resolving after the last note', async () => {
    const f = fakePlayer();
    const pb = createAudioPlayback(f.native);
    await pb.playMelody(scheduleMelody(melody([64, 67, 69]), 120));
    expect(f.played.map((p) => p.midi)).toEqual([64, 67, 69]);
  });

  test('a bundled clip plays as one file for the whole schedule, with no note samples', async () => {
    const f = fakePlayer(['tune']);
    const pb = createAudioPlayback(f.native);
    await pb.playMelody(scheduleMelody(melody([64, 67, 69]), 120), 'tune');
    expect(f.playedClips).toEqual([{ clipId: 'tune', durationMs: 1500 }]);
    expect(f.played).toEqual([]);
  });

  test('a melody without a bundled clip falls back to the note samples', async () => {
    const f = fakePlayer(['other']);
    const pb = createAudioPlayback(f.native);
    await pb.playMelody(scheduleMelody(melody([64, 67]), 120), 'tune');
    expect(f.played.map((p) => p.midi)).toEqual([64, 67]);
  });

  test('preload throws on an out-of-range note (never partial playback)', async () => {
    const pb = createAudioPlayback(fakePlayer().native);
    await expect(pb.preload([200])).rejects.toThrow();
  });

  test('playReferenceTone plays the tuning tone for a note', async () => {
    const f = fakePlayer();
    await createAudioPlayback(f.native).playReferenceTone(64);
    expect(f.played).toEqual([{ midi: 64, durationMs: 800 }]);
  });

  test('a new tap and a new melody first silence whatever is still ringing', async () => {
    const f = fakePlayer();
    const pb = createAudioPlayback(f.native);
    await pb.playReferenceTone(64);
    await pb.playMelody(scheduleMelody(melody([64]), 120));
    expect(f.stops()).toBe(2);
  });

  test('stop is idempotent', async () => {
    const f = fakePlayer();
    const pb = createAudioPlayback(f.native);
    await pb.stop();
    await pb.stop();
    expect(f.stops()).toBe(2); // safe to call repeatedly
  });
});
