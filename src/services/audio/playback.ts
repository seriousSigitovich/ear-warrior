// Audio playback service (contracts/audio-playback.md). Sound comes from bundled files, voiced offline
// (assets/guitar-rig/render_library.py): one clip per library tune and one sample per fretboard note.
// Nothing is synthesised at run time. The native player is injected so orchestration (correct note per
// midi, in order, resolve-after-last, idempotent stop) stays contract-testable; the real binding is
// isolated in `defaultNativePlayer`.
import { MediaClock, createMediaClock } from '../../lib/mediaClock';
import { PlaybackMelody, totalDurationMs } from '../../lib/schedule';
import { sampleManifest } from './samples';

export interface AudioPlayback {
  preload(midiNotes: number[]): Promise<void>;
  /**
   * Play a melody. With the id of a bundled clip it plays as one file; without one (or when the clip is
   * missing) it falls back to the note samples, one per scheduled note.
   *
   * `rate` is the speed it starts at (1 = the tune's own tempo); the clip keeps its pitch. The schedule
   * must already be laid out at that rate (`scheduleMelody(m, m.tempoBpm * rate)`). Resolves when the
   * melody's schedule has played out, however the speed changed meanwhile, or at once when something
   * else takes over the output.
   *
   * With `fromMs`, the schedule is a phrase of the clip's tune starting that far into the clip (in the
   * tune's own tempo): the clip plays from there and fades out just before the next phrase would begin.
   */
  playMelody(m: PlaybackMelody, clipId?: string, rate?: number, fromMs?: number): Promise<void>;
  /**
   * Change the speed of the melody sounding now: the rest of it plays at `rate` and its end moves to
   * match. The note fallback picks it up from its next note. No effect when nothing is playing.
   */
  setRate(rate: number): void;
  playReferenceTone(midi: number): Promise<void>;
  stop(): Promise<void>;
}

/** A clip that is sounding. */
export interface ClipHandle {
  /** Change its speed in place, pitch kept. */
  setRate(rate: number): void;
  /** Fade it out over `fadeMs` (a short default) and free its player (no-op once released or stopped). */
  release(fadeMs?: number): void;
}

/** Injectable native player: plays a bundled note sample or melody clip and can stop output. */
export interface NativePlayer {
  /** Play the sample for `midi`, resolving after `durationMs`. */
  playTone(midi: number, durationMs: number): Promise<void>;
  /**
   * Start the bundled clip `clipId` now, `fromMs` into it, at `rate` (pitch kept); null (nothing played)
   * if there is none. The caller keeps time and releases it.
   */
  startClip(clipId: string, rate: number, fromMs: number): ClipHandle | null;
  /** Check the samples for `midis` exist so a melody never starts and then runs out of notes. */
  preloadTones(midis: number[]): Promise<void>;
  stopAll(): Promise<void>;
}

/**
 * Legato overlap: playTone resolves after the note's hold (so scheduling and total play time are
 * unchanged), but the sample is left ringing for this much longer before its player is released. The
 * tail overlaps the next note's attack, connecting the line instead of cutting each note off.
 */
const RELEASE_TAIL_MS = 220;

/**
 * A phrase played out of its tune's clip fades over this much clip time (tempo 1×), ending just as the
 * next phrase's first note would sound, so none of it leaks in.
 */
const PHRASE_FADE_MS = 90;

/** A clip is released this long after its schedule ends, so its own ring-out is never cut. */
const CLIP_RELEASE_MS = 800;

/**
 * How long a tapped fret rings. The samples are sustained (a plain 1.5 s hold left taps stacking up
 * into a smear), and ending a voice by dropping it mid-ring is an audible click, so every voice is
 * faded out over FADE_MS instead of being cut.
 */
const TAP_HOLD_MS = 800;
const FADE_MS = 120;
/** Fade used when a new sound takes over from one still ringing: quick, but still click-free. */
const TAKEOVER_FADE_MS = 50;
const FADE_STEP_MS = 10;

/** Real adapter: play the bundled files through expo-audio. */
export function defaultNativePlayer(): NativePlayer {
  /* eslint-disable @typescript-eslint/no-explicit-any -- untyped native module handles */
  let audioMod: any;
  const active = new Set<any>(); // players still playing or ringing out
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const audio = () => (audioMod ??= require('expo-audio'));
  // Lazily required: the registry `require`s the audio files, which only Metro can resolve (not the
  // pure-logic test runner).
  const bundled = (): typeof import('./bundled') => require('./bundled');

  // `remove()` only drops the player from expo-audio's registry; the native ExoPlayer and its
  // AudioTrack are freed by `release()`. Without it each play leaks a track until GC, and Android
  // stops creating tracks (~40 per app) — playback goes silent partway through a session.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped native player handle
  const dispose = (player: any) => {
    try {
      player.remove();
      player.release();
    } catch {
      // already released
    }
  };

  /** Ramp the volume to silence over `ms`, then free the player. Safe to call on a player already fading. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped native player handle
  const fadeOut = (player: any, ms: number) => {
    if (!active.delete(player)) return; // already fading or released
    const steps = Math.max(1, Math.round(ms / FADE_STEP_MS));
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      try {
        player.volume = Math.max(0, 1 - step / steps);
      } catch {
        step = steps; // player already gone
      }
      if (step >= steps) {
        clearInterval(timer);
        dispose(player);
      }
    }, FADE_STEP_MS);
  };

  /** Start `source` now; it plays `holdMs`, then fades out over `fadeMs` and is released. */
  const start = (source: number, holdMs: number, fadeMs: number) => {
    const player = audio().createAudioPlayer(source);
    active.add(player);
    player.play();
    setTimeout(() => fadeOut(player, fadeMs), Math.max(0, holdMs - fadeMs));
  };

  /** Time-stretch, not tape speed: the notes the learner looks for must not change pitch. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped native player handle
  const applyRate = (player: any, rate: number) => {
    try {
      player.shouldCorrectPitch = true;
      player.setPlaybackRate(rate, 'high');
    } catch {
      // released meanwhile
    }
  };

  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  return {
    async preloadTones(midis) {
      for (const midi of midis) {
        if (bundled().NOTE_CLIPS[midi] === undefined)
          throw new Error(`No bundled sample for MIDI ${midi}.`);
      }
    },
    async playTone(midi, durationMs) {
      const source = bundled().NOTE_CLIPS[midi];
      if (source === undefined) throw new Error(`No bundled sample for MIDI ${midi}.`);
      start(source, durationMs + RELEASE_TAIL_MS, FADE_MS);
      await wait(durationMs);
    },
    startClip(clipId, rate, fromMs) {
      const source = bundled().MELODY_CLIPS[clipId];
      if (source === undefined) return null;
      const player = audio().createAudioPlayer(source);
      active.add(player);
      if (rate !== 1) applyRate(player, rate);
      // Commands reach the native player in order, so it is at the phrase before it starts playing.
      if (fromMs > 0) void player.seekTo(fromMs / 1000);
      player.play();
      return {
        setRate: (next) => {
          if (active.has(player)) applyRate(player, next);
        },
        release: (fadeMs = FADE_MS) => fadeOut(player, fadeMs),
      };
    },
    async stopAll() {
      // Fade rather than drop: the samples are loud and sustained, so a hard stop is a click.
      for (const player of [...active]) fadeOut(player, TAKEOVER_FADE_MS);
    },
  };
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** The clip sounding now: where it is, where its schedule ends, and the wait for that end. */
interface ClipRun {
  handle: ClipHandle;
  clock: MediaClock;
  /** End of the melody's schedule, in the clip's own (tempo-1×) milliseconds from where it started. */
  endMs: number;
  /** A phrase out of a longer clip: it fades out before its end instead of ringing on. */
  cut: boolean;
  timer?: ReturnType<typeof setTimeout>;
  done: () => void;
}

/** Create a playback service over an injected native player (defaults to the real one). */
export function createAudioPlayback(native: NativePlayer = defaultNativePlayer()): AudioPlayback {
  // Bumped by every stop, tap and new melody: a note-by-note melody still being scheduled sees it
  // changed and plays no further notes (a clip is one file, so silencing it is enough).
  let generation = 0;
  // Speed of what is sounding; the note fallback reads it before each note.
  let rate = 1;
  let clip: ClipRun | null = null;

  /** Something else takes over: the sounding clip's wait ends now (stopAll silences the audio). */
  const settle = () => {
    const run = clip;
    if (!run) return;
    clip = null;
    clearTimeout(run.timer);
    run.done();
  };

  /** (Re)time the end of the clip's schedule from where it is now at its current speed. */
  const arm = (run: ClipRun) => {
    clearTimeout(run.timer);
    run.timer = setTimeout(
      () => {
        if (clip !== run) return;
        clip = null;
        run.done();
        if (run.cut) {
          run.handle.release(PHRASE_FADE_MS / run.clock.rate);
          return;
        }
        // Its own ring-out is left to sound, stretched like the rest, then the player is freed.
        setTimeout(() => run.handle.release(), CLIP_RELEASE_MS / run.clock.rate);
      },
      run.clock.remaining(run.endMs, Date.now()),
    );
  };

  return {
    async preload(midiNotes) {
      sampleManifest(midiNotes); // range guard: throws on any note outside E2–E6
      await native.preloadTones(midiNotes);
    },
    async playMelody(m, clipId, startRate = 1, fromMs) {
      // Nothing may still be ringing under the melody (a replay pressed mid-clip, a tapped fret).
      const mine = ++generation;
      settle();
      rate = startRate;
      await native.stopAll();
      if (generation !== mine) return;
      const handle = clipId ? native.startClip(clipId, startRate, fromMs ?? 0) : null;
      if (handle) {
        const cut = fromMs !== undefined;
        await new Promise<void>((done) => {
          const run: ClipRun = {
            handle,
            clock: createMediaClock(startRate, Date.now()),
            // A phrase hands over to its fade just before the next phrase would begin.
            endMs: Math.max(0, totalDurationMs(m) * startRate - (cut ? PHRASE_FADE_MS : 0)),
            cut,
            done,
          };
          clip = run;
          arm(run);
        });
        return;
      }
      // Schedule each note by startMs; resolve only after the final note completes, or early once
      // something else has taken over the output. The schedule is laid out at `startRate`, so each
      // gap and note is rescaled to the speed in effect when it comes up.
      let cursor = 0;
      for (const note of m.notes) {
        if (note.startMs > cursor) {
          await wait(((note.startMs - cursor) * startRate) / rate);
          cursor = note.startMs;
        }
        if (generation !== mine) return;
        await native.playTone(note.midi, (note.durationMs * startRate) / rate);
        cursor += note.durationMs;
      }
    },
    setRate(next) {
      rate = next;
      const run = clip;
      if (!run) return;
      run.clock.setRate(next, Date.now());
      run.handle.setRate(next);
      arm(run);
    },
    async playReferenceTone(midi) {
      // One string at a time: the previous tap fades as the new one starts, so taps never stack.
      generation++;
      settle();
      await native.stopAll();
      await native.playTone(midi, TAP_HOLD_MS);
    },
    stop: () => {
      generation++;
      settle();
      return native.stopAll();
    },
  };
}
