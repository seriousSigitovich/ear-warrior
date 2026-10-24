"""10 variants of a ~7 s guitar solo, synthesized in pure Python (no deps).

Run: python3 solos.py          -> renders all variants to NN-name.mp3 (needs ffmpeg)
     python3 solos.py 03 07    -> only the listed ids

Lead notes are MIDI pitches (high E string: MIDI = 64 + fret).
"""
import math
import os
import random
import struct
import subprocess
import sys
import wave
from dataclasses import dataclass, field

SR = 44100
random.seed(7)


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def lowpass(x, cutoff):
    a = 1 - math.exp(-2 * math.pi * cutoff / SR)
    y, s = [0.0] * len(x), 0.0
    for i, v in enumerate(x):
        s += a * (v - s)
        y[i] = s
    return y


def interp(points, t):
    if t <= points[0][0]:
        return points[0][1]
    for (t0, v0), (t1, v1) in zip(points, points[1:]):
        if t <= t1:
            return v0 + (v1 - v0) * (t - t0) / (t1 - t0) if t1 > t0 else v1
    return points[-1][1]


# ---- note helpers -----------------------------------------------------------
def nt(beat, ln, midi, bend=None, vib=None, trem=None, amp=1.0):
    """bend: [(beat, semis)], vib: (delay beats, depth, depth at end), trem: pick length in beats"""
    return (beat, ln, midi, bend or [], vib, trem, amp)


def run(beat, pitches, step=0.25, **kw):
    return [nt(beat + i * step, step, p, **kw) for i, p in enumerate(pitches)]


def cyc(cell, n):
    return [cell[i % len(cell)] for i in range(n)]


def harmonize(lead, pcs, amp=0.7):
    """Add a diatonic third above every in-scale note."""
    scale = [m for m in range(30, 110) if m % 12 in pcs]
    out = list(lead)
    for beat, ln, midi, bend, vib, trem, a in lead:
        if midi in scale:
            h = scale[scale.index(midi) + 2]
            out.append((beat, ln, h, bend, vib, trem, a * amp))
    return out


@dataclass
class V:
    id: str
    name: str
    bpm: float
    beats: float
    chords: list  # (beat, length, root midi)
    lead: list
    rhythm: str = "sustain"  # sustain | chug8 | gallop
    drums: str = "rock"  # rock | half | metal
    fill: tuple = (8, 9)  # snare roll start beat, crash beat
    gain: float = 5.5
    lp: float = 5200
    nharm: int = 14
    tail: float = 0.9


# ---- lead lines -------------------------------------------------------------
def lead_01():
    L = [
        nt(0, 1.5, 76, [(0, -2), (0.25, 0)], (0.6, 0.30, 0.35)),
        nt(1.5, 0.5, 72), nt(2, 0.5, 74), nt(2.5, 0.5, 76),
        nt(3, 1, 81, [(0, -2), (0.12, 0)], (0.4, 0.30, 0.40)),
    ]
    for g, grp in enumerate([(69, 72, 74), (72, 74, 76), (74, 76, 79), (76, 79, 81)]):
        L += run(4 + g, grp, 1 / 3)
    L.append(nt(8, 1, 84, [(0, 0), (0.3, 2)], (0.45, 0.35, 0.40)))
    L += run(9, [86, 84, 83, 81, 79, 77, 76, 74], 0.25)
    L.append(nt(11, 1, 71, [(0, 0), (0.15, 0), (1.0, 5)], None, 0.125))
    L.append(nt(12, 1.5, 81, [(0, 0), (0.25, 7)], (0.7, 0.20, 0.55)))
    return L


def lead_02():  # E phrygian dominant shred
    L = run(0, [76, 77, 80, 81, 83, 84, 86, 88, 86, 84, 83, 81, 80, 77, 76, 74])
    L += run(4, [77, 81, 84, 89, 84, 81, 77, 72])
    L += run(6, [76, 80, 83, 88, 83, 80, 76, 71])
    L += run(8, [72, 76, 81, 84, 81, 76, 72, 69])
    L += run(10, [88, 89] * 8, 0.125)
    L.append(nt(12, 3.5, 88, [(0, -5), (0.2, 0)], (0.6, 0.3, 0.6)))
    return L


def lead_03():  # D minor ballad
    return [
        nt(0, 2, 74, [(0, -2), (0.4, 0)], (0.8, 0.25, 0.4)),
        nt(2, 1, 77, vib=(0.4, 0.25, 0.3)),
        nt(3, 1, 81, [(0, -2), (0.3, 0)], (0.5, 0.3, 0.4)),
        nt(4, 0.5, 76), nt(4.5, 0.5, 79),
        nt(5, 1, 84, [(0, 0), (0.4, 2)], (0.6, 0.3, 0.4)),
        nt(6, 2.5, 81, vib=(0.5, 0.4, 0.8)),
    ]


def lead_04():  # E minor pentatonic blues
    L = [
        nt(0, 1.5, 79, [(0, 0), (0.25, 2)], (0.7, 0.3, 0.4)),
        nt(1.5, 0.5, 76), nt(2, 0.5, 79), nt(2.5, 0.5, 81),
        nt(3, 1, 76, vib=(0.3, 0.3, 0.4)),
        nt(4, 1, 86, [(0, 0), (0.25, 2)], (0.6, 0.3, 0.4)),
    ]
    L += run(5, [88, 86, 83, 81]) + run(6, [79, 76, 74, 76])
    L += [
        nt(7, 1, 79, vib=(0.3, 0.3, 0.4)),
        nt(8, 1.5, 86, [(0, -2), (0.2, 0)], (0.5, 0.3, 0.4)),
        nt(9.5, 1.5, 88, [(0, -2), (0.3, 0)], (0.6, 0.3, 0.7)),
    ]
    return L


def lead_05():  # C minor cinematic
    return [
        nt(0, 2, 79, [(0, -2), (0.3, 0)], (0.7, 0.3, 0.4)),
        nt(2, 1, 75), nt(3, 1, 79),
        nt(4, 1, 82, [(0, 0), (0.25, 2)], (0.6, 0.3, 0.4)),
        nt(5, 0.5, 84), nt(5.5, 0.5, 82),
        nt(6, 1, 86), nt(7, 1, 89, vib=(0.4, 0.3, 0.4)),
        nt(8, 2, 84, [(0, -5), (0.2, 0)], (0.6, 0.3, 0.7)),
    ]


def lead_06():  # A harmonic minor neoclassical
    S = [69, 71, 72, 74, 76, 77, 80, 81, 83, 84, 86, 88]
    L = []
    for i in range(8):
        L += run(i, [S[i], S[i + 2], S[i + 1], S[i + 3]])
    for k, j in enumerate([8, 7, 6]):
        L += run(8 + k, [S[j + 3], S[j + 1], S[j + 2], S[j]])
    L.append(nt(11, 1, 80, trem=0.125))
    L.append(nt(12, 2.5, 88, [(0, -7), (0.3, 0)], (0.7, 0.3, 0.6)))
    return L


def lead_07():  # G dorian, triplet groove
    L = []
    for g, grp in enumerate([[79, 82, 86], [79, 82, 86], [77, 81, 84], [82, 86, 89]]):
        L += run(g, grp, 1 / 3)
    L += [nt(4, 1, 84, [(0, 0), (0.25, 2)], (0.6, 0.3, 0.4)), nt(5, 0.5, 81), nt(5.5, 0.5, 79)]
    L += [nt(6, 0.5, 82), nt(6.5, 0.5, 79), nt(7, 0.5, 74), nt(7.5, 0.5, 79)]
    L += run(8, [77, 81, 84, 81, 84, 89], 1 / 3)
    L.append(nt(10, 2.5, 86, [(0, -3), (0.25, 0)], (0.6, 0.3, 0.6)))
    return L


def lead_08():  # B minor tapping-style arpeggios
    L = []
    L += run(0, cyc([74, 78, 83, 86, 83, 78], 16))
    L += run(4, cyc([74, 79, 83, 86, 83, 79], 16))
    L += run(8, cyc([74, 78, 81, 86, 81, 78], 12))
    L += run(11, cyc([76, 81, 85, 88, 85, 81], 12))
    L.append(nt(14, 3, 86, [(0, -5), (0.25, 0)], (0.6, 0.3, 0.7)))
    return L


def lead_09():  # E minor, screaming + dive bomb
    L = [nt(0, 1, 88, [(0, 0), (0.2, 1)], (0.3, 0.5, 0.6))]
    L += run(1, [86, 83, 79, 83])
    L += [nt(2, 1, 84, [(0, -2), (0.25, 0)], (0.5, 0.3, 0.4)), nt(3, 1, 83, trem=0.125)]
    L += run(4, [72, 76, 79, 84, 79, 76, 79, 84]) + run(6, [74, 78, 81, 86, 81, 78, 81, 86])
    L += [
        nt(8, 1, 88, [(0, 0), (0.25, 2)], (0.5, 0.4, 0.5)),
        nt(9, 1, 84, vib=(0.3, 0.4, 0.5)),
        nt(10, 3, 88, [(0, 0), (1.2, 0), (3, -18)], (0.4, 0.4, 0.6)),
    ]
    return L


def lead_10():  # A minor, galloping metal with harmonized thirds
    S = [69, 71, 72, 74, 76, 77, 79, 81, 83, 84, 86, 88]
    L = [
        nt(0, 1, 81, vib=(0.4, 0.25, 0.3)), nt(1, 0.5, 84), nt(1.5, 0.5, 83),
        nt(2, 1, 81, vib=(0.4, 0.25, 0.3)), nt(3, 0.5, 79), nt(3.5, 0.5, 81),
        nt(4, 0.5, 84), nt(4.5, 0.5, 81), nt(5, 1, 84, vib=(0.4, 0.25, 0.3)),
        nt(6, 0.5, 86), nt(6.5, 0.5, 83), nt(7, 0.5, 79), nt(7.5, 0.5, 83),
    ]
    L += run(8, S[:8]) + run(10, S[4:12])
    L.append(nt(12, 3.5, 84, [(0, -3), (0.2, 0)], (0.6, 0.3, 0.7)))
    return harmonize(L, {9, 11, 0, 2, 4, 5, 7})


VARIANTS = [
    V("01", "am-classic", 132, 13.5, [(0, 4, 45), (4, 4, 41), (8, 4, 43), (12, 2.5, 45)], lead_01(),
      fill=(11, 12)),
    V("02", "e-phrygian-shred", 150, 15.5,
      [(0, 4, 40), (4, 2, 41), (6, 2, 40), (8, 2, 45), (10, 2, 41), (12, 3.5, 40)], lead_02(),
      rhythm="chug8", fill=(11, 12), gain=6.5),
    V("03", "dm-ballad", 84, 8.5, [(0, 2, 50), (2, 2, 46), (4, 2, 48), (6, 2.5, 50)], lead_03(),
      drums="half", fill=(5, 6), gain=4.0, lp=4200, nharm=12),
    V("04", "em-pentatonic-blues", 108, 11,
      [(0, 4, 40), (4, 2, 45), (6, 2, 40), (8, 1.5, 47), (9.5, 1.5, 40)], lead_04(),
      rhythm="chug8", fill=(8.5, 9.5), gain=4.5, lp=4600),
    V("05", "cm-cinematic", 100, 10, [(0, 2, 48), (2, 2, 44), (4, 2, 51), (6, 2, 46), (8, 2, 48)],
      lead_05(), drums="half", fill=(7, 8), gain=5.0, lp=4800),
    V("06", "a-harmonic-minor-neoclassic", 144, 14.5,
      [(0, 4, 45), (4, 2, 40), (6, 2, 45), (8, 2, 50), (10, 2, 40), (12, 2.5, 45)], lead_06(),
      rhythm="chug8", fill=(11, 12)),
    V("07", "g-dorian-triplets", 120, 12.5,
      [(0, 4, 43), (4, 2, 48), (6, 2, 43), (8, 2, 41), (10, 2.5, 43)], lead_07(),
      rhythm="chug8", fill=(9, 10)),
    V("08", "bm-tapping", 168, 17,
      [(0, 4, 47), (4, 4, 43), (8, 3, 50), (11, 3, 45), (14, 3, 47)], lead_08(),
      rhythm="chug8", drums="metal", fill=(13, 14), gain=6.0),
    V("09", "em-scream-divebomb", 128, 13,
      [(0, 4, 40), (4, 2, 36), (6, 2, 38), (8, 2, 36), (10, 3, 40)], lead_09(),
      rhythm="chug8", fill=(9, 10), gain=8.0, lp=6500, nharm=18),
    V("10", "am-gallop-harmony", 160, 16,
      [(0, 4, 45), (4, 2, 41), (6, 2, 43), (8, 2, 45), (10, 2, 41), (12, 4, 45)], lead_10(),
      rhythm="gallop", drums="metal", fill=(11, 12), gain=6.0),
]


# ---- synthesis --------------------------------------------------------------
def render_lead(v, N, BEAT):
    out = [0.0] * N
    for beat0, blen, midi, bend, vib, trem, amp in v.lead:
        t0 = int(beat0 * BEAT * SR)
        dur = blen * BEAT
        rel = min(0.09, 0.6 * dur)
        n = int((dur + rel) * SR)
        pts = bend if bend and bend[0][0] == 0 else [(0, 0)] + bend
        phase = 0.0
        for i in range(n):
            if t0 + i >= N:
                break
            tau = i / SR
            tb = tau / BEAT
            semis = interp(pts, tb) if len(pts) > 1 else 0.0
            if vib:
                vd, vdepth, vend = vib
                if tb > vd:
                    ramp = min(1.0, (tb - vd) / 0.4)
                    depth = vdepth + (vend - vdepth) * min(1.0, tb / blen)
                    semis += depth * ramp * math.sin(2 * math.pi * 5.6 * (tau - vd * BEAT))
            f = hz(midi + semis)
            phase += f / SR
            w, k = 0.0, 1
            while k <= v.nharm and k * f < 16000:
                w += math.sin(2 * math.pi * phase * k) / k ** 1.1
                k += 1
            x = math.tanh(v.gain * w)
            env = min(1.0, tau / 0.004) * (0.72 + 0.28 * math.exp(-tau * 3.0))
            if tau > dur:
                env *= max(0.0, 1 - (tau - dur) / rel)
            if trem:
                pp = (tb / trem) % 1.0
                env *= 0.6 + 0.4 * math.exp(-5 * pp)
            out[t0 + i] += x * env * amp
    return lowpass(lowpass(out, v.lp), 7000)


def hit(out, N, t0, dur, root, nh, gain, rel):
    freqs = [hz(root), hz(root + 7), hz(root + 12)]
    for i in range(int(dur * SR)):
        if t0 + i >= N:
            break
        tau = i / SR
        w = 0.0
        for f in freqs:
            for k in range(1, nh + 1):
                w += math.sin(2 * math.pi * f * k * tau + k) / k
        env = min(1.0, tau / 0.006) * (0.8 + 0.2 * math.exp(-tau * 2))
        if tau > dur - rel:
            env *= max(0.0, (dur - tau) / rel)
        out[t0 + i] += math.tanh(gain * w) * env


def render_rhythm(v, N, BEAT):
    out = [0.0] * N
    pattern = {"chug8": [(0, 0.45), (0.5, 0.45)], "gallop": [(0, 0.45), (0.5, 0.22), (0.75, 0.22)]}.get(v.rhythm)
    for idx, (beat0, blen, root) in enumerate(v.chords):
        t0 = int(beat0 * BEAT * SR)
        if pattern is None or idx == len(v.chords) - 1:
            hit(out, N, t0, blen * BEAT + 0.15, root, 6, 2.5, 0.12)
            continue
        b = 0
        while b < blen - 1e-9:
            for off, ln in pattern:
                if b + off < blen:
                    hit(out, N, t0 + int((b + off) * BEAT * SR), ln * BEAT, root, 5, 3.5, 0.02)
            b += 1
    return lowpass(lowpass(out, 1800 if pattern is None else 1500), 2200)


def add(buf, N, t0, sig, g=1.0):
    for i, s in enumerate(sig):
        if t0 + i >= N:
            break
        buf[t0 + i] += s * g


def kick():
    ph, out = 0.0, []
    for i in range(int(0.28 * SR)):
        t = i / SR
        ph += (45 + 90 * math.exp(-t * 28)) / SR
        out.append(math.sin(2 * math.pi * ph) * math.exp(-t * 11) * min(1, t / 0.002))
    return out


def snare():
    return [
        (random.uniform(-1, 1) * 0.8 + math.sin(2 * math.pi * 190 * i / SR) * 0.5) * math.exp(-i / SR * 20)
        for i in range(int(0.22 * SR))
    ]


def noise_hp(seconds, decay):
    prev, out = 0.0, []
    for i in range(int(seconds * SR)):
        s = random.uniform(-1, 1)
        out.append((s - prev) * math.exp(-i / SR * decay))
        prev = s
    return out


PATTERNS = {  # (kick beats, snare beats, hat step or None, hat gain)
    "rock": ([0, 1.5, 2, 3.5], [1, 3], 0.5, 0.18),
    "half": ([0, 2.5], [2], 1.0, 0.12),
    "metal": ([x * 0.5 for x in range(8)], [1, 3], None, 0),
}


def render_drums(v, N, BEAT):
    out = [0.0] * N
    K, S, H, C = kick(), snare(), noise_hp(0.05, 90), noise_hp(1.8, 2.6)
    at = lambda b: int(b * BEAT * SR)
    fill, crash = v.fill
    ks, ss, hstep, hg = PATTERNS[v.drums]
    bar = 0
    while bar < fill:
        for b in ks:
            if bar + b < fill:
                add(out, N, at(bar + b), K, 0.9)
        for b in ss:
            if bar + b < fill:
                add(out, N, at(bar + b), S, 0.55)
        if hstep:
            b = 0.0
            while b < 4:
                if bar + b < fill:
                    add(out, N, at(bar + b), H, hg)
                b += hstep
        bar += 4
    t, half = fill, (crash - fill) / 2
    while t < crash - 1e-9:
        add(out, N, at(t), S, 0.15 + 0.4 * (t - fill) / (crash - fill))
        t += 0.125 if t - fill < half else 0.0625
    add(out, N, at(crash), K, 1.0)
    add(out, N, at(0), C, 0.35)
    add(out, N, at(crash), C, 0.6)
    return lowpass(out, 14000)


def reverb(x):
    out = [0.0] * len(x)
    for d, fb in [(1557, 0.80), (1617, 0.79), (1491, 0.78), (1422, 0.77), (1277, 0.76)]:
        buf, idx = [0.0] * d, 0
        for i, s in enumerate(x):
            y = buf[idx]
            buf[idx] = s + y * fb
            idx = (idx + 1) % d
            out[i] += y
    return [s * 0.12 for s in out]


def mix(v):
    BEAT = 60.0 / v.bpm
    N = int((v.beats * BEAT + v.tail) * SR)
    lead = render_lead(v, N, BEAT)
    rhy = render_rhythm(v, N, BEAT)
    drums = render_drums(v, N, BEAT)
    rg = 0.22 if v.rhythm == "sustain" else 0.28
    delay = lambda x, d, g: [0.0] * d + [s * g for s in x[: N - d]]
    L = [lead[i] * 0.62 + rhy[i] * rg + drums[i] * 0.5 for i in range(N)]
    R = L[:]
    dot = int(0.75 * BEAT * SR)
    for d, g in [(dot, 0.30), (3 * dot, 0.12)]:
        L = [a + b for a, b in zip(L, delay(lead, d, g * 0.62))]
    for d, g in [(2 * dot, 0.22), (4 * dot, 0.09)]:
        R = [a + b for a, b in zip(R, delay(lead, d, g * 0.62))]
    rv = reverb([lead[i] * 0.62 + rhy[i] * 0.1 for i in range(N)])
    L = [a + b for a, b in zip(L, rv)]
    R = [a + b * 0.9 for a, b in zip(R, rv[37:] + [0.0] * 37)]
    g = 0.89 / max(max(abs(s) for s in L), max(abs(s) for s in R))
    fade = int(0.15 * SR)
    for ch in (L, R):
        for i in range(fade):
            ch[N - 1 - i] *= i / fade
    return [s * g for s in L], [s * g for s in R], N


def main():
    want = set(sys.argv[1:])
    for v in VARIANTS:
        if want and v.id not in want:
            continue
        L, R, N = mix(v)
        base = f"{v.id}-{v.name}"
        with wave.open(base + ".wav", "wb") as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(b"".join(struct.pack("<hh", int(l * 32767), int(r * 32767)) for l, r in zip(L, R)))
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", base + ".wav",
                        "-codec:a", "libmp3lame", "-b:a", "192k", base + ".mp3"], check=True)
        os.remove(base + ".wav")
        print(f"{base}.mp3  {N / SR:.1f}s")


if __name__ == "__main__":
    main()
