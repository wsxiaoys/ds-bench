import json
import os
import subprocess

import numpy as np
import pytest
import soundfile as sf

PROJECT_DIR = "/home/user/project"
ENTRYPOINT = "analyze_swing.py"

SR = 22050
BPM = 100.0
BEAT_PERIOD = 60.0 / BPM  # 0.6 s
N_BEATS = 16
FIRST_BEAT = 0.5  # seconds of leading silence before beat 0
TRAILING_SILENCE = 0.7
CLICK_DUR = 0.03  # seconds
CLICK_FREQ = 1500.0
DECAY_TAU = 0.008  # exponential decay time constant (s)
DOWNBEAT_AMP = 1.0
OFFBEAT_AMP = 0.5

STRAIGHT_OFFSET = 0.30  # offbeat exactly halfway -> ratio 1.0
SWING_OFFSET = 0.40  # offbeat at 2/3 of the beat -> ratio 2.0

N_CLICKS = 2 * N_BEATS  # one downbeat + one offbeat per beat

STRAIGHT_WAV = "/tmp/straight.wav"
SWING_WAV = "/tmp/swing.wav"
STRAIGHT_OUT = "/tmp/out_straight.json"
SWING_OUT = "/tmp/out_swing.json"


def _click(n_samples):
    """A short, sharp, exponentially-decaying tonal click starting at sample 0."""
    t = np.arange(n_samples) / SR
    env = np.exp(-t / DECAY_TAU)
    tone = np.sin(2.0 * np.pi * CLICK_FREQ * t)
    return (env * tone).astype(np.float64)


def _synthesize(offbeat_offset):
    total_dur = FIRST_BEAT + N_BEATS * BEAT_PERIOD + TRAILING_SILENCE
    n_total = int(round(total_dur * SR))
    signal = np.zeros(n_total, dtype=np.float64)
    click_len = int(round(CLICK_DUR * SR))
    base = _click(click_len)

    onset_times = []
    for k in range(N_BEATS):
        beat_time = FIRST_BEAT + k * BEAT_PERIOD
        # downbeat (subdivision 0)
        i0 = int(round(beat_time * SR))
        signal[i0:i0 + click_len] += DOWNBEAT_AMP * base
        onset_times.append(beat_time)
        # offbeat (subdivision 1)
        off_time = beat_time + offbeat_offset
        i1 = int(round(off_time * SR))
        signal[i1:i1 + click_len] += OFFBEAT_AMP * base
        onset_times.append(off_time)

    # Normalize headroom to avoid clipping when overlapping tails add up.
    peak = np.max(np.abs(signal))
    if peak > 0:
        signal = 0.9 * signal / peak
    return signal.astype(np.float32), total_dur, sorted(onset_times)


def _run_analyzer(input_wav, output_json):
    if os.path.exists(output_json):
        os.remove(output_json)
    result = subprocess.run(
        ["python3", ENTRYPOINT, "--input", input_wav, "--output", output_json],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
    )
    return result


def _load_output(output_json):
    with open(output_json) as f:
        return json.load(f)


@pytest.fixture(scope="module")
def straight_result():
    signal, dur, _ = _synthesize(STRAIGHT_OFFSET)
    sf.write(STRAIGHT_WAV, signal, SR)
    proc = _run_analyzer(STRAIGHT_WAV, STRAIGHT_OUT)
    return proc, dur


@pytest.fixture(scope="module")
def swing_result():
    signal, dur, _ = _synthesize(SWING_OFFSET)
    sf.write(SWING_WAV, signal, SR)
    proc = _run_analyzer(SWING_WAV, SWING_OUT)
    return proc, dur


def _assert_common_structure(data, duration):
    for key in ("tempo", "swing_ratio", "mean_microtiming_ms", "per_onset"):
        assert key in data, f"Output JSON is missing required top-level key '{key}'."

    per_onset = data["per_onset"]
    assert isinstance(per_onset, list), "'per_onset' must be a JSON array."

    times = []
    sub0 = 0
    sub1 = 0
    for i, entry in enumerate(per_onset):
        for key in ("time", "beat_index", "subdivision", "deviation_ms"):
            assert key in entry, f"per_onset[{i}] is missing required key '{key}'."
        sub = entry["subdivision"]
        assert sub in (0, 1), f"per_onset[{i}].subdivision must be 0 or 1, got {sub!r}."
        if sub == 0:
            sub0 += 1
        else:
            sub1 += 1
        t = float(entry["time"])
        assert -0.05 <= t <= duration + 0.05, (
            f"per_onset[{i}].time={t} lies outside the audio duration [0, {duration}]."
        )
        times.append(t)

    assert times == sorted(times), "per_onset entries must be ordered by ascending time."
    for a, b in zip(times, times[1:]):
        assert b > a, "per_onset times must be strictly increasing (no duplicate onsets)."

    # Roughly half of the onsets are downbeats and half are offbeats.
    assert abs(sub0 - N_BEATS) <= 2, (
        f"Expected about {N_BEATS} subdivision-0 onsets, got {sub0}."
    )
    assert abs(sub1 - N_BEATS) <= 2, (
        f"Expected about {N_BEATS} subdivision-1 onsets, got {sub1}."
    )


def test_straight_command_succeeds(straight_result):
    proc, _ = straight_result
    assert proc.returncode == 0, (
        f"Analyzer exited with {proc.returncode} on the straight recording.\n"
        f"STDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )
    assert os.path.isfile(STRAIGHT_OUT), (
        f"Expected output JSON at {STRAIGHT_OUT} was not created."
    )


def test_straight_structure(straight_result):
    _, dur = straight_result
    data = _load_output(STRAIGHT_OUT)
    _assert_common_structure(data, dur)


def test_straight_tempo(straight_result):
    data = _load_output(STRAIGHT_OUT)
    tempo = float(data["tempo"])
    assert abs(tempo - BPM) <= 10.0, (
        f"Estimated tempo {tempo} BPM is not within 10 BPM of the true tempo {BPM}."
    )


def test_straight_onset_count(straight_result):
    data = _load_output(STRAIGHT_OUT)
    n = len(data["per_onset"])
    assert n == N_CLICKS, (
        f"Expected exactly {N_CLICKS} detected onsets (one per click), got {n}."
    )


def test_straight_swing_ratio(straight_result):
    data = _load_output(STRAIGHT_OUT)
    ratio = float(data["swing_ratio"])
    assert abs(ratio - 1.0) <= 0.15, (
        f"Straight recording swing_ratio {ratio} is not within 0.15 of the true value 1.0."
    )


def test_straight_microtiming(straight_result):
    data = _load_output(STRAIGHT_OUT)
    mt = float(data["mean_microtiming_ms"])
    assert abs(mt) <= 10.0, (
        f"Straight recording mean_microtiming_ms {mt} exceeds the 10 ms tolerance."
    )


def test_swing_command_succeeds(swing_result):
    proc, _ = swing_result
    assert proc.returncode == 0, (
        f"Analyzer exited with {proc.returncode} on the swung recording.\n"
        f"STDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )
    assert os.path.isfile(SWING_OUT), (
        f"Expected output JSON at {SWING_OUT} was not created."
    )


def test_swing_structure(swing_result):
    _, dur = swing_result
    data = _load_output(SWING_OUT)
    _assert_common_structure(data, dur)


def test_swing_tempo(swing_result):
    data = _load_output(SWING_OUT)
    tempo = float(data["tempo"])
    assert abs(tempo - BPM) <= 10.0, (
        f"Estimated tempo {tempo} BPM is not within 10 BPM of the true tempo {BPM}."
    )


def test_swing_onset_count(swing_result):
    data = _load_output(SWING_OUT)
    n = len(data["per_onset"])
    assert n == N_CLICKS, (
        f"Expected exactly {N_CLICKS} detected onsets (one per click), got {n}."
    )


def test_swing_swing_ratio(swing_result):
    data = _load_output(SWING_OUT)
    ratio = float(data["swing_ratio"])
    assert abs(ratio - 2.0) <= 0.15, (
        f"Swung recording swing_ratio {ratio} is not within 0.15 of the true value 2.0."
    )


def test_swing_microtiming(swing_result):
    data = _load_output(SWING_OUT)
    mt = float(data["mean_microtiming_ms"])
    assert abs(mt) <= 10.0, (
        f"Swung recording mean_microtiming_ms {mt} exceeds the 10 ms tolerance."
    )


def test_swing_discrimination(straight_result, swing_result):
    straight = _load_output(STRAIGHT_OUT)
    swung = _load_output(SWING_OUT)
    diff = float(swung["swing_ratio"]) - float(straight["swing_ratio"])
    assert diff >= 0.5, (
        "The swung recording must yield a clearly larger swing_ratio than the straight one "
        f"(difference >= 0.5); got straight={straight['swing_ratio']}, "
        f"swung={swung['swing_ratio']}, diff={diff}."
    )
