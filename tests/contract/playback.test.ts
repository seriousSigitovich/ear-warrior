import { Melody } from '../../src/models';
import { hzFromMidi, noteName } from '../../src/lib/pitchNote';
import { scheduleMelody } from '../../src/lib/schedule';
import { NativePlayer, createAudioPlayback } from '../../src/services/audio/playback';

function melody(midis: number[]): Melody {
  return {
    id: 'm',
    difficultyId: 'L1',
    scale: 'C_major',
    tempoBpm: 90,
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
  const playedClips: {
    clipId: string;
    fromMs: number;
    rates: number[];
    released: boolean;
    paused: boolean;
    fadeMs?: number;
  }[] = [];
  let stops = 0;
  const native: NativePlayer = {
    async playTone(midi, durationMs) {
      played.push({ midi, durationMs });
    },
    startClip(clipId, rate, fromMs) {
      if (!clips.includes(clipId)) return null;
      const clip = {
        clipId,
        fromMs,
        rates: [rate],
        released: false,
        paused: false,
        fadeMs: undefined as number | undefined,
      };
      playedClips.push(clip);
      return {
        setRate: (r) => clip.rates.push(r),
        pause: () => {
          clip.paused = true;
        },
        resume: () => {
          clip.paused = false;
        },
        release: (fadeMs) => {
          clip.released = true;
          clip.fadeMs = fadeMs;
        },
      };
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

  describe('clip timeline', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    /** Start a melody and report whether it has resolved. */
    function start(pb: ReturnType<typeof createAudioPlayback>, bpm: number, rate?: number) {
      let resolved = false;
      void pb.playMelody(scheduleMelody(melody([64, 67, 69]), bpm), 'tune', rate).then(() => {
        resolved = true;
      });
      return () => resolved;
    }

    test('a bundled clip plays as one file for the whole schedule, with no note samples', async () => {
      const f = fakePlayer(['tune']);
      const done = start(createAudioPlayback(f.native), 120);
      await jest.advanceTimersByTimeAsync(1499);
      expect(done()).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      expect(done()).toBe(true);
      expect(f.playedClips.map((c) => [c.clipId, c.rates])).toEqual([['tune', [1]]]);
      expect(f.played).toEqual([]);
      // Its ring-out sounds after the schedule, then the player is freed.
      expect(f.playedClips[0].released).toBe(false);
      await jest.advanceTimersByTimeAsync(800);
      expect(f.playedClips[0].released).toBe(true);
    });

    test('a slowed clip plays at that rate and lasts as long as its slowed schedule', async () => {
      const f = fakePlayer(['tune']);
      const done = start(createAudioPlayback(f.native), 120 * 0.5, 0.5);
      await jest.advanceTimersByTimeAsync(2999);
      expect(done()).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      expect(done()).toBe(true);
      expect(f.playedClips[0].rates).toEqual([0.5]);
    });

    test('a speed change mid-clip retunes the clip and moves its end', async () => {
      const f = fakePlayer(['tune']);
      const pb = createAudioPlayback(f.native);
      const done = start(pb, 120); // 1500 ms at full speed
      await jest.advanceTimersByTimeAsync(500);
      pb.setRate(0.5); // the last 1000 ms of the clip now take 2000
      expect(f.playedClips[0].rates).toEqual([1, 0.5]);
      await jest.advanceTimersByTimeAsync(1999);
      expect(done()).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      expect(done()).toBe(true);
    });

    test('a phrase plays from its place in the clip and fades out before the next phrase', async () => {
      const f = fakePlayer(['tune']);
      const pb = createAudioPlayback(f.native);
      let resolved = false;
      // Three beats at 120 = 1500 ms of phrase, 2000 ms into the tune's clip, at half speed.
      void pb
        .playMelody(scheduleMelody(melody([64, 67, 69]), 120 * 0.5), 'tune', 0.5, 2000)
        .then(() => (resolved = true));
      await jest.advanceTimersByTimeAsync(0);
      expect(f.playedClips[0].fromMs).toBe(2000);
      // 1500 clip ms, less the 90 ms fade, at half speed: 2820 wall ms.
      await jest.advanceTimersByTimeAsync(2819);
      expect(resolved).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      expect(resolved).toBe(true);
      expect(f.playedClips[0].released).toBe(true);
      expect(f.playedClips[0].fadeMs).toBe(180);
    });

    test('a paused clip stands still and ends as much later as it was held', async () => {
      const f = fakePlayer(['tune']);
      const pb = createAudioPlayback(f.native);
      const done = start(pb, 120); // 1500 ms
      await jest.advanceTimersByTimeAsync(500);
      pb.pause();
      expect(f.playedClips[0].paused).toBe(true);
      await jest.advanceTimersByTimeAsync(5000);
      expect(done()).toBe(false);
      pb.resume();
      expect(f.playedClips[0].paused).toBe(false);
      await jest.advanceTimersByTimeAsync(999);
      expect(done()).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      expect(done()).toBe(true);
    });

    test('a stop ends a paused clip, and the next melody is not held', async () => {
      const f = fakePlayer(['tune']);
      const pb = createAudioPlayback(f.native);
      const first = start(pb, 120);
      await jest.advanceTimersByTimeAsync(100);
      pb.pause();
      await pb.stop();
      await jest.advanceTimersByTimeAsync(0);
      expect(first()).toBe(true);
      const second = start(pb, 120);
      await jest.advanceTimersByTimeAsync(1500);
      expect(second()).toBe(true);
    });

    test('a stop ends the clip’s wait at once', async () => {
      const f = fakePlayer(['tune']);
      const pb = createAudioPlayback(f.native);
      const done = start(pb, 120);
      await jest.advanceTimersByTimeAsync(100);
      await pb.stop();
      await jest.advanceTimersByTimeAsync(0);
      expect(done()).toBe(true);
      pb.setRate(0.5); // nothing sounding: no effect
      expect(f.playedClips[0].rates).toEqual([1]);
    });
  });

  test('a speed change reaches a note-by-note melody from its next note', async () => {
    const f = fakePlayer();
    const pb = createAudioPlayback(f.native);
    let first = () => {};
    const playTone = f.native.playTone;
    f.native.playTone = async (midi, durationMs) => {
      await playTone(midi, durationMs);
      if (f.played.length === 1) await new Promise<void>((r) => (first = r));
    };
    const playing = pb.playMelody(scheduleMelody(melody([64, 67]), 120));
    await new Promise((r) => setTimeout(r, 0)); // the first note is sounding
    pb.setRate(0.5);
    first();
    await playing;
    expect(f.played.map((p) => p.durationMs)).toEqual([500, 1000]);
  });

  test('a slowed melody without a clip spaces its note samples out', async () => {
    const f = fakePlayer();
    const pb = createAudioPlayback(f.native);
    await pb.playMelody(scheduleMelody(melody([64, 67]), 120 * 0.75), undefined, 0.75);
    expect(f.played.map((p) => Math.round(p.durationMs))).toEqual([667, 667]);
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

  test('a stop or a tap ends a note-by-note melody: no further notes are played', async () => {
    for (const interrupt of ['stop', 'tap'] as const) {
      const f = fakePlayer();
      // Each note holds until released, so the interrupt lands mid-melody.
      let release = () => {};
      const playTone = f.native.playTone;
      f.native.playTone = async (midi, durationMs) => {
        await playTone(midi, durationMs);
        if (midi !== 72) await new Promise<void>((r) => (release = r));
      };
      const pb = createAudioPlayback(f.native);
      const playing = pb.playMelody(scheduleMelody(melody([64, 67, 69]), 120));
      await new Promise((r) => setTimeout(r, 0)); // the first note is sounding
      await (interrupt === 'stop' ? pb.stop() : pb.playReferenceTone(72));
      release();
      await playing;
      expect(f.played.map((p) => p.midi)).toEqual(interrupt === 'stop' ? [64] : [64, 72]);
    }
  });

  test('stop is idempotent', async () => {
    const f = fakePlayer();
    const pb = createAudioPlayback(f.native);
    await pb.stop();
    await pb.stop();
    expect(f.stops()).toBe(2); // safe to call repeatedly
  });
});
