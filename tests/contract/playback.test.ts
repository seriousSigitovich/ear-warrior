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
        fadeMs: undefined as number | undefined,
      };
      playedClips.push(clip);
      return {
        setRate: (r) => clip.rates.push(r),
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

  describe('position, pause and picking up (spec 021)', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    // Three beats at 120 bpm: notes start at 0, 500, 1000; 1500 ms in all.
    const three = (bpm = 120) => scheduleMelody(melody([64, 67, 69]), bpm);

    test('position is null until something sounds, then follows the clip in the tune’s own time', async () => {
      const f = fakePlayer(['tune']);
      const pb = createAudioPlayback(f.native);
      expect(pb.position()).toBeNull();
      void pb.playMelody(three(), 'tune');
      await jest.advanceTimersByTimeAsync(500);
      expect(pb.position()).toBe(500);
    });

    test('position does not depend on the speed: half speed covers half as much tune per second', async () => {
      const f = fakePlayer(['tune']);
      const pb = createAudioPlayback(f.native);
      void pb.playMelody(three(60), 'tune', 0.5);
      await jest.advanceTimersByTimeAsync(1000);
      expect(pb.position()).toBe(500);
      pb.setRate(1);
      await jest.advanceTimersByTimeAsync(200);
      expect(pb.position()).toBe(700);
    });

    test('position never passes the end of the schedule, and is null once the melody is done', async () => {
      const f = fakePlayer(['tune']);
      const pb = createAudioPlayback(f.native);
      void pb.playMelody(three(), 'tune');
      await jest.advanceTimersByTimeAsync(1499);
      expect(pb.position()).toBe(1499);
      await jest.advanceTimersByTimeAsync(1);
      expect(pb.position()).toBeNull();
    });

    test('pause says where it stopped, silences the clip and ends its wait', async () => {
      const f = fakePlayer(['tune']);
      const pb = createAudioPlayback(f.native);
      let resolved = false;
      void pb.playMelody(three(), 'tune').then(() => (resolved = true));
      await jest.advanceTimersByTimeAsync(700);
      const before = f.stops();
      expect(pb.pause()).toBe(700);
      expect(f.stops()).toBe(before + 1);
      await jest.advanceTimersByTimeAsync(0);
      expect(resolved).toBe(true);
      expect(pb.position()).toBeNull();
    });

    test('pause with nothing sounding does nothing and says null', () => {
      const f = fakePlayer(['tune']);
      const pb = createAudioPlayback(f.native);
      expect(pb.pause()).toBeNull();
      expect(f.stops()).toBe(0);
    });

    test('a clip picked up at an offset starts that far in and runs only the rest', async () => {
      const f = fakePlayer(['tune']);
      const pb = createAudioPlayback(f.native);
      let resolved = false;
      void pb.playMelody(three(), 'tune', 1, undefined, 500).then(() => (resolved = true));
      await jest.advanceTimersByTimeAsync(0);
      expect(f.playedClips[0].fromMs).toBe(500);
      expect(pb.position()).toBe(500);
      await jest.advanceTimersByTimeAsync(999);
      expect(resolved).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      expect(resolved).toBe(true);
    });

    test('a phrase picked up at an offset adds it to the phrase’s place in the clip', async () => {
      const f = fakePlayer(['tune']);
      const pb = createAudioPlayback(f.native);
      let resolved = false;
      void pb.playMelody(three(), 'tune', 1, 2000, 500).then(() => (resolved = true));
      await jest.advanceTimersByTimeAsync(0);
      expect(f.playedClips[0].fromMs).toBe(2500);
      // 1500 − 500 offset − 90 fade
      await jest.advanceTimersByTimeAsync(909);
      expect(resolved).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      expect(resolved).toBe(true);
    });

    test('pause then play from there carries on at the same spot, at a new speed too', async () => {
      const f = fakePlayer(['tune']);
      const pb = createAudioPlayback(f.native);
      void pb.playMelody(three(), 'tune');
      await jest.advanceTimersByTimeAsync(600);
      const where = pb.pause()!;
      void pb.playMelody(three(60), 'tune', 0.5, undefined, where);
      await jest.advanceTimersByTimeAsync(0);
      expect(f.playedClips[1].fromMs).toBe(600);
      expect(f.playedClips[1].rates).toEqual([0.5]);
      expect(pb.position()).toBe(600);
    });

    /** Note samples that hold for their duration, so a melody is still playing when it is paused. */
    function holding() {
      const f = fakePlayer();
      f.native.playTone = async (midi, durationMs) => {
        f.played.push({ midi, durationMs });
        await new Promise<void>((r) => setTimeout(r, durationMs));
      };
      return f;
    }

    test('the note fallback follows the same clock and stops between notes on pause', async () => {
      const f = holding();
      const pb = createAudioPlayback(f.native);
      void pb.playMelody(three(), undefined);
      await jest.advanceTimersByTimeAsync(700);
      expect(pb.position()).toBe(700);
      expect(pb.pause()).toBe(700);
      await jest.advanceTimersByTimeAsync(2000);
      expect(f.played.map((p) => p.midi)).toEqual([64, 67]);
    });

    test('the note fallback picks up at the first note that begins at or after the offset', async () => {
      const f = holding();
      const pb = createAudioPlayback(f.native);
      void pb.playMelody(three(), undefined, 1, undefined, 400);
      await jest.advanceTimersByTimeAsync(0);
      // no wait for the 100 ms gap: it starts on the next whole note
      expect(f.played.map((p) => p.midi)).toEqual([67]);
      expect(pb.position()).toBe(500);
      await jest.advanceTimersByTimeAsync(500);
      expect(f.played.map((p) => p.midi)).toEqual([67, 69]);
    });

    test('an offset exactly on a note starts with that note', async () => {
      const f = holding();
      const pb = createAudioPlayback(f.native);
      void pb.playMelody(three(), undefined, 1, undefined, 500);
      await jest.advanceTimersByTimeAsync(0);
      expect(f.played.map((p) => p.midi)).toEqual([67]);
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
