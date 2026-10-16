import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseProbe, validateForPlatform, videoNoFromFile, type Probe } from './video.js';

const good: Probe = { durationS: 26.1, width: 1080, height: 1920, videoCodec: 'h264', audioCodec: 'aac', sizeBytes: 3_206_169 };

test('videoNoFromFile reads the experiment number from the render name', () => {
  assert.equal(videoNoFromFile('assets/video/challenge/out/H14_youtube-A/ear-challenge-31.mp4'), 31);
  assert.equal(videoNoFromFile('/x/ear-challenge-07.mp4'), 7);
  assert.equal(videoNoFromFile('/x/promo.mp4'), null);
});

test('parseProbe maps ffprobe JSON (streams + format) to a Probe', () => {
  const p = parseProbe({
    streams: [
      { codec_type: 'video', codec_name: 'h264', width: 1080, height: 1920 },
      { codec_type: 'audio', codec_name: 'aac' },
    ],
    format: { duration: '26.100000', size: '3206169' },
  });
  assert.deepEqual(p, good);
});

test('parseProbe tolerates a file without audio and rejects a file without video', () => {
  const p = parseProbe({ streams: [{ codec_type: 'video', codec_name: 'h264', width: 720, height: 1280 }], format: { duration: '5', size: '100' } });
  assert.equal(p.audioCodec, null);
  assert.throws(() => parseProbe({ streams: [{ codec_type: 'audio', codec_name: 'aac' }], format: { duration: '5', size: '1' } }), /no video stream/i);
  assert.throws(() => parseProbe(null), /ffprobe/i);
});

test('a project render passes both platforms', () => {
  assert.deepEqual(validateForPlatform(good, 'youtube'), []);
  assert.deepEqual(validateForPlatform(good, 'instagram'), []);
});

test('wrong orientation, codec and audio are reported in plain words', () => {
  const bad = validateForPlatform({ ...good, width: 1920, height: 1080, videoCodec: 'hevc', audioCodec: 'opus' }, 'instagram');
  assert.ok(bad.some((m) => /not vertical/i.test(m) && m.includes('1920x1080')));
  assert.ok(bad.some((m) => /H\.264/.test(m) && m.includes('hevc')));
  assert.ok(bad.some((m) => /AAC/.test(m) && m.includes('opus')));
});

test('duration limits differ by platform', () => {
  assert.ok(validateForPlatform({ ...good, durationS: 200 }, 'youtube').some((m) => /not a Short/i.test(m)));
  assert.ok(validateForPlatform({ ...good, durationS: 200 }, 'instagram').some((m) => /3 minutes/i.test(m)));
  assert.ok(validateForPlatform({ ...good, durationS: 2 }, 'instagram').some((m) => /shorter than 3/i.test(m)));
  assert.deepEqual(validateForPlatform({ ...good, durationS: 2 }, 'youtube'), []);
});

test('Instagram refuses files over 100 MB, YouTube does not', () => {
  const big = { ...good, sizeBytes: 150 * 1024 * 1024 };
  assert.ok(validateForPlatform(big, 'instagram').some((m) => /100 MB/.test(m)));
  assert.deepEqual(validateForPlatform(big, 'youtube'), []);
});
