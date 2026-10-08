// Ear Warrior landing — "hear it, play it back, see what landed", in the browser.
// A small port of the app's pipeline (src/lib/segment.ts, src/services/grading/grade.ts):
//   frames (rms + pitch per ~20 ms)  ->  notes  ->  best-fit alignment against the melody.
// Pure functions, no DOM and no audio IO, so they can be unit-tested in Node. Everything runs on
// the visitor's device: no audio is stored or sent anywhere.
(function (root) {
  "use strict";

  var MIN_HZ = 80;      // below E2
  var MAX_HZ = 1320;    // above E6
  var YIN_WINDOW = 1024;
  var YIN_THRESHOLD = 0.15;

  var SEG = {
    clarityMin: 0.8,        // frames below this count as unpitched
    gapMs: 80,              // silence this long closes a note
    onsetConfirmFrames: 3,  // a pitch change must persist this many frames to start a new note
    attackGuardMs: 40,      // leading part of a note excluded from its pitch estimate
    minVoicedFrames: 3,     // a note needs at least this many pitched frames after the guard
    energyJump: 1.6,        // rms ratio frame-to-frame that signals a fresh pluck on the same pitch
    refractoryMs: 110       // no second energy onset this soon after the last one
  };

  function rms(buf, from, to) {
    var s = 0;
    for (var i = from; i < to; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / Math.max(1, to - from));
  }

  /** YIN pitch estimate for one buffer. Returns { hz, clarity }; hz = 0 when nothing periodic. */
  function yin(buf, sr) {
    var W = YIN_WINDOW;
    var maxTau = Math.min(Math.floor(sr / MIN_HZ), buf.length - W - 1);
    var minTau = Math.max(2, Math.floor(sr / MAX_HZ));
    if (maxTau <= minTau + 2) return { hz: 0, clarity: 0 };

    var cm = new Float32Array(maxTau + 1);
    cm[0] = 1;
    var run = 0;
    for (var tau = 1; tau <= maxTau; tau++) {
      var sum = 0;
      for (var j = 0; j < W; j++) {
        var diff = buf[j] - buf[j + tau];
        sum += diff * diff;
      }
      run += sum;
      cm[tau] = run > 0 ? (sum * tau) / run : 1;
    }

    var best = -1;
    for (var t = minTau; t <= maxTau; t++) {
      if (cm[t] < YIN_THRESHOLD) {
        while (t + 1 <= maxTau && cm[t + 1] < cm[t]) t++;
        best = t;
        break;
      }
    }
    if (best < 0) return { hz: 0, clarity: 0 };

    var refined = best;
    if (best > 1 && best < maxTau) {
      var s0 = cm[best - 1], s1 = cm[best], s2 = cm[best + 1];
      var den = 2 * (2 * s1 - s2 - s0);
      if (den !== 0) refined = best + (s2 - s0) / den;
    }
    return { hz: sr / refined, clarity: Math.max(0, 1 - cm[best]) };
  }

  function midiFromHz(hz) { return Math.round(69 + 12 * Math.log(hz / 440) / Math.LN2); }
  function pitchClass(midi) { return ((midi % 12) + 12) % 12; }
  function median(a) {
    var s = a.slice().sort(function (x, y) { return x - y; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /**
   * frames: [{ t (ms), rms, hz, clarity }]   cfg: { gate }  (gate = rms below which it's silence)
   * Returns detected notes: [{ midi, hz, startMs, endMs }].
   * Boundaries (silence / pitch change that persists / energy jump) are decided separately from
   * the pitch estimate (median over the note, attack dropped), as in the app.
   */
  function segment(frames, cfg) {
    var gate = cfg.gate;
    var notes = [];
    var group = [];
    var pending = [];
    var lastVoicedT = null;
    var lastOnsetT = -1e9;

    function voiced(f) { return f.rms >= gate && f.hz > 0 && f.clarity >= SEG.clarityMin; }

    function flush(g) {
      if (!g.length) return;
      var cutoff = g[0].t + SEG.attackGuardMs;
      var stable = g.filter(function (f) { return f.t >= cutoff; });
      if (stable.length < SEG.minVoicedFrames) return;
      var hz = median(stable.map(function (f) { return f.hz; }));
      notes.push({ midi: midiFromHz(hz), hz: hz, startMs: g[0].t, endMs: g[g.length - 1].t });
    }
    function close() { flush(group); group = []; pending = []; }

    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      var prev = i > 0 ? frames[i - 1] : null;

      if (!voiced(f)) {
        if (group.length && lastVoicedT !== null && f.t - lastVoicedT >= SEG.gapMs) close();
        continue;
      }
      if (!group.length) { group.push(f); lastVoicedT = f.t; lastOnsetT = f.t; continue; }

      if (f.t - lastVoicedT >= SEG.gapMs) { close(); group.push(f); lastVoicedT = f.t; lastOnsetT = f.t; continue; }

      // Energy onset: a fresh pluck of the same pitch has no silence before it, only a jump in level.
      if (prev && prev.rms > 0 && f.rms > prev.rms * SEG.energyJump && f.t - lastOnsetT >= SEG.refractoryMs) {
        close();
        group.push(f);
        lastVoicedT = f.t;
        lastOnsetT = f.t;
        continue;
      }

      var fm = midiFromHz(f.hz);
      var gm = midiFromHz(median(group.map(function (x) { return x.hz; })));
      if (fm === gm) {
        group = group.concat(pending, [f]);
        pending = [];
        lastVoicedT = f.t;
        continue;
      }
      pending = pending.length && midiFromHz(pending[0].hz) !== fm ? [f] : pending.concat([f]);
      lastVoicedT = f.t;
      if (pending.length >= SEG.onsetConfirmFrames) {
        flush(group);
        group = pending;
        pending = [];
        lastOnsetT = group[0].t;
      }
    }
    close();
    return notes;
  }

  /**
   * Best-fit alignment (edit distance) of played notes to the target, octave-insensitive so a
   * voice, a guitar and a bass can all answer the same melody.
   * target: [midi...]   played: [{ midi }...]
   * Returns { results: ['matched'|'wrong'|'missed' per target note], matched, extras }.
   */
  function grade(target, played) {
    var n = target.length, m = played.length;
    function same(i, j) { return pitchClass(target[i]) === pitchClass(played[j].midi); }
    var dp = [];
    for (var i = 0; i <= n; i++) { dp.push(new Array(m + 1).fill(0)); dp[i][0] = i; }
    for (var j = 0; j <= m; j++) dp[0][j] = j;
    for (i = 1; i <= n; i++) {
      for (j = 1; j <= m; j++) {
        dp[i][j] = Math.min(dp[i - 1][j - 1] + (same(i - 1, j - 1) ? 0 : 1), dp[i - 1][j] + 1, dp[i][j - 1] + 1);
      }
    }
    var results = new Array(n), extras = 0, matched = 0;
    i = n; j = m;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + (same(i - 1, j - 1) ? 0 : 1)) {
        if (same(i - 1, j - 1)) { results[i - 1] = "matched"; matched++; } else results[i - 1] = "wrong";
        i--; j--;
      } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
        results[i - 1] = "missed"; i--;
      } else {
        extras++; j--;
      }
    }
    return { results: results, matched: matched, extras: extras };
  }

  /** Silence gate from ambient rms samples taken before the learner starts playing. */
  function gateFrom(ambient) {
    var floor = 0.012;
    if (!ambient.length) return floor;
    var s = ambient.slice().sort(function (a, b) { return a - b; });
    var p90 = s[Math.min(s.length - 1, Math.floor(s.length * 0.9))];
    return Math.max(floor, p90 * 3);
  }

  root.EarMatch = { yin: yin, rms: rms, segment: segment, grade: grade, gateFrom: gateFrom, midiFromHz: midiFromHz, SEG: SEG };
  if (typeof module !== "undefined" && module.exports) module.exports = root.EarMatch;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
