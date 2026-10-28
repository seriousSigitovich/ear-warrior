import numpy as np
import pyloudnorm as pyln
import pytest
from scipy.signal import freqz

from guitar_rig.amp import PRESETS, play_through
from guitar_rig.cab import cab_ir
from guitar_rig.midi import read_midi, write_midi
from guitar_rig.render import render_song
from guitar_rig.riff import build
from guitar_rig.synth import SR, Note, hz, render_di


def peak_hz(x, lo, hi, sr=SR):
    """Dominant frequency in [lo, hi] with parabolic interpolation on the log spectrum."""
    pad = 1 << 18
    spec = np.log(np.abs(np.fft.rfft(x * np.hanning(len(x)), pad)) + 1e-12)
    freqs = np.fft.rfftfreq(pad, 1 / sr)
    band = np.where((freqs >= lo) & (freqs <= hi))[0]
    i = band[np.argmax(spec[band])]
    a, b, c = spec[i - 1], spec[i], spec[i + 1]
    return freqs[i] + (a - c) / (2 * (a - 2 * b + c)) * (freqs[1] - freqs[0])


def cents(a, b):
    return 1200 * np.log2(a / b)


@pytest.mark.parametrize("pitch", [40, 57, 76])
def test_voice_is_in_tune(pitch):
    di = render_di([Note(0, 1.0, pitch)], humanize_notes=False)
    f = hz(pitch)
    assert abs(cents(peak_hz(di[int(0.1 * SR):int(0.8 * SR)], f * 0.9, f * 1.1), f)) < 3


def test_bend_reaches_target_pitch():
    di = render_di([Note(0, 1.0, 57, bend=((0, 0), (0.2, 2), (1.0, 2)))], humanize_notes=False)
    target = hz(57) * 2 ** (2 / 12)
    assert abs(cents(peak_hz(di[int(0.5 * SR):int(0.9 * SR)], target * 0.9, target * 1.1), target)) < 10


def test_palm_mute_dies_faster():
    def tail_ratio(mute):
        di = render_di([Note(0, 0.6, 40, mute=mute)], humanize_notes=False)
        rms = lambda a, b: np.sqrt(np.mean(di[int(a * SR):int(b * SR)] ** 2))
        return rms(0.3, 0.4) / rms(0.02, 0.1)
    assert tail_ratio(True) < 0.25 * tail_ratio(False)


def test_same_seed_same_take_different_seed_differs():
    notes = [Note(0, 0.3, 40), Note(0.3, 0.3, 43)]
    assert np.array_equal(render_di(notes, seed=1), render_di(notes, seed=1))
    assert not np.array_equal(render_di(notes, seed=1), render_di(notes, seed=2))


def test_cab_rolls_off_the_top():
    w, h = freqz(cab_ir(SR), worN=8192, fs=SR)
    mag = np.abs(h)
    band = lambda lo, hi: mag[(w >= lo) & (w <= hi)].mean()
    assert band(9000, 16000) < 0.1 * band(1000, 4000)
    assert band(20, 50) < 0.5 * band(100, 4000)
    assert np.isclose(np.sum(cab_ir(SR) ** 2), 1.0)


def test_amp_adds_harmonics_and_stays_bounded():
    di = render_di([Note(0, 1.0, 45)], humanize_notes=False)
    out = play_through(di, SR, PRESETS["metal"], cab_ir(SR))
    assert np.isfinite(out).all() and np.abs(out).max() < 4   # cab gain can exceed the 0.9 into it; the mix re-levels

    def flatness(x):
        s = np.abs(np.fft.rfft(x * np.hanning(len(x)))) + 1e-12
        return np.exp(np.mean(np.log(s))) / np.mean(s)
    assert flatness(out[:SR]) > 2 * flatness(di[:SR])   # distortion fills in the spectrum


def test_midi_roundtrip_keeps_notes_and_bends(tmp_path):
    rhythm, lead, bpm = build()
    path = tmp_path / "riff.mid"
    write_midi(path, rhythm, lead, bpm)
    song = read_midi(path)
    assert song.bpm == pytest.approx(bpm)
    assert len(song.rhythm) == len(rhythm) and len(song.lead) == len(lead)
    for a, b in zip(sorted(lead, key=lambda n: n.start), song.lead):
        assert b.start == pytest.approx(a.start, abs=0.003) and b.pitch == a.pitch
    bent = next(n for n in song.lead if n.bend and n.bend[0][1] < -1)   # the pre-bent opening note
    assert bent.bend[0][1] == pytest.approx(-2, abs=0.05) and bent.bend[-1][1] == pytest.approx(0, abs=0.05)


def test_chugs_are_muted_and_stabs_ring(tmp_path):
    rhythm, lead, bpm = build()
    path = tmp_path / "riff.mid"
    write_midi(path, rhythm, lead, bpm)
    song = read_midi(path)
    chord_notes = [n for n in song.rhythm if n.pitch in (47, 52)]   # the 5th and octave of the E stab
    assert chord_notes and not any(n.mute for n in chord_notes)
    assert sum(n.mute for n in song.rhythm) > 60


def test_render_is_stereo_double_tracked_and_bounded(tmp_path):
    rhythm, lead, bpm = build()
    path = tmp_path / "riff.mid"
    write_midi(path, rhythm[:30], lead[:4], bpm)
    audio = render_song(read_midi(path))
    assert audio.shape[0] == 2 and audio.dtype == np.float32 and np.isfinite(audio).all()
    assert 0.1 < np.abs(audio).max() <= 10 ** (-1 / 20) + 1e-6   # ceiling at -1 dBFS
    assert not np.allclose(audio[0], audio[1])   # two different takes, one per side
    assert pyln.Meter(SR).integrated_loudness(audio.T) == pytest.approx(-14.0, abs=1.0)
