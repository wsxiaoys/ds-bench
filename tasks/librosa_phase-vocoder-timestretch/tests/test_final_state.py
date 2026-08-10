import json
import os
import shutil
import subprocess

import numpy as np
import pytest
import soundfile as sf
import librosa

PROJECT_DIR = "/home/user/project"
RUN_SCRIPT = os.path.join(PROJECT_DIR, "run.py")

INPUT_WAV = "/tmp/pv_test_input.wav"
OUTPUT_DIR = "/tmp/pv_out"
STRETCHED_WAV = os.path.join(OUTPUT_DIR, "stretched.wav")
SHIFTED_WAV = os.path.join(OUTPUT_DIR, "shifted.wav")
ANALYSIS_JSON = os.path.join(OUTPUT_DIR, "analysis.json")

SR = 22050
DURATION = 3.0
N_SAMPLES = int(round(SR * DURATION))
HOP = 512
STRETCH_FACTOR = 1.5
SEMITONES = 7
TONE_HZ = 220.0
CLICK_TIMES = [0.5, 1.0, 1.5, 2.0, 2.5]
PITCH_RATIO = 2.0 ** (SEMITONES / 12.0)

EXPECTED_KEYS = {
    "sample_rate",
    "stretch_factor",
    "pitch_shift_semitones",
    "input_duration_seconds",
    "stretched_duration_seconds",
    "shifted_duration_seconds",
    "transient_frames",
    "transient_times_seconds",
}


def _build_input_wav(path):
    """Deterministic mono test signal: 220 Hz sustained tone with fades plus
    five broadband click bursts on top."""
    t = np.arange(N_SAMPLES) / SR
    tone = 0.3 * np.sin(2.0 * np.pi * TONE_HZ * t)

    # Fades to avoid sharp onsets at the signal edges.
    fade_in = int(round(0.3 * SR))
    fade_out = int(round(0.1 * SR))
    env = np.ones(N_SAMPLES)
    env[:fade_in] = np.linspace(0.0, 1.0, fade_in, endpoint=False)
    env[N_SAMPLES - fade_out:] = np.linspace(1.0, 0.0, fade_out)
    signal = tone * env

    rng = np.random.default_rng(0)
    burst_len = int(round(0.005 * SR))
    decay = np.exp(-np.linspace(0.0, 5.0, burst_len))
    for ct in CLICK_TIMES:
        start = int(round(ct * SR))
        noise = rng.standard_normal(burst_len)
        burst = noise * decay
        peak = np.max(np.abs(burst))
        if peak > 0:
            burst = 0.8 * burst / peak
        signal[start:start + burst_len] += burst

    signal = signal.astype(np.float32)
    sf.write(path, signal, SR, subtype="FLOAT")


def _median_voiced_f0(y, sr, fmin, fmax):
    f0, voiced_flag, _ = librosa.pyin(y, sr=sr, fmin=fmin, fmax=fmax)
    voiced = f0[np.asarray(voiced_flag, dtype=bool)]
    voiced = voiced[np.isfinite(voiced)]
    assert voiced.size > 0, "pyin found no voiced frames while measuring pitch."
    return float(np.median(voiced))


@pytest.fixture(scope="session")
def run_result():
    _build_input_wav(INPUT_WAV)
    if os.path.isdir(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)

    assert os.path.isfile(RUN_SCRIPT), f"Expected solution script at {RUN_SCRIPT}."

    proc = subprocess.run(
        ["python3", "run.py", "--input", INPUT_WAV, "--output-dir", OUTPUT_DIR],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=600,
    )
    print("run.py stdout:\n" + proc.stdout)
    print("run.py stderr:\n" + proc.stderr)
    assert proc.returncode == 0, f"run.py exited with code {proc.returncode}: {proc.stderr}"

    data = {}
    if os.path.isfile(ANALYSIS_JSON):
        with open(ANALYSIS_JSON) as f:
            data = json.load(f)
    return data


def test_artifacts_exist(run_result):
    assert os.path.isfile(STRETCHED_WAV), f"Missing output {STRETCHED_WAV}."
    assert os.path.isfile(SHIFTED_WAV), f"Missing output {SHIFTED_WAV}."
    assert os.path.isfile(ANALYSIS_JSON), f"Missing output {ANALYSIS_JSON}."


def test_report_schema(run_result):
    data = run_result
    assert isinstance(data, dict), "analysis.json must contain a JSON object."
    assert set(data.keys()) == EXPECTED_KEYS, (
        f"analysis.json keys mismatch. Expected {sorted(EXPECTED_KEYS)}, got {sorted(data.keys())}."
    )
    assert int(data["sample_rate"]) == SR, f"sample_rate must be {SR}, got {data['sample_rate']}."
    assert abs(float(data["stretch_factor"]) - STRETCH_FACTOR) < 1e-6, (
        f"stretch_factor must be {STRETCH_FACTOR}, got {data['stretch_factor']}."
    )
    assert abs(float(data["pitch_shift_semitones"]) - SEMITONES) < 1e-6, (
        f"pitch_shift_semitones must be {SEMITONES}, got {data['pitch_shift_semitones']}."
    )


def test_time_stretch_duration(run_result):
    data = run_result
    y, sr = librosa.load(STRETCHED_WAV, sr=None, mono=True)
    assert sr == SR, f"stretched.wav sample rate must be {SR}, got {sr}."
    measured = len(y) / sr
    target = STRETCH_FACTOR * DURATION
    assert abs(measured - target) <= 0.02 * target, (
        f"stretched.wav duration {measured:.4f}s not within 2% of {target:.4f}s."
    )
    assert abs(float(data["stretched_duration_seconds"]) - measured) <= 0.01, (
        f"stretched_duration_seconds {data['stretched_duration_seconds']} does not match measured {measured:.4f}s."
    )
    assert abs(float(data["input_duration_seconds"]) - DURATION) <= 0.01, (
        f"input_duration_seconds {data['input_duration_seconds']} not within 10 ms of {DURATION}s."
    )


def test_pitch_shift_duration(run_result):
    data = run_result
    y, sr = librosa.load(SHIFTED_WAV, sr=None, mono=True)
    assert sr == SR, f"shifted.wav sample rate must be {SR}, got {sr}."
    measured = len(y) / sr
    assert abs(measured - DURATION) <= 0.03, (
        f"shifted.wav duration {measured:.4f}s must equal input duration {DURATION}s within 30 ms."
    )
    assert abs(float(data["shifted_duration_seconds"]) - measured) <= 0.01, (
        f"shifted_duration_seconds {data['shifted_duration_seconds']} does not match measured {measured:.4f}s."
    )


def test_pitch_shift_fundamental(run_result):
    y_in, _ = librosa.load(INPUT_WAV, sr=None, mono=True)
    y_shift, _ = librosa.load(SHIFTED_WAV, sr=None, mono=True)
    f0_in = _median_voiced_f0(y_in, SR, fmin=100.0, fmax=400.0)
    f0_shift = _median_voiced_f0(y_shift, SR, fmin=150.0, fmax=600.0)
    expected = f0_in * PITCH_RATIO
    rel_err = abs(f0_shift - expected) / expected
    assert rel_err <= 0.02, (
        f"shifted fundamental {f0_shift:.2f} Hz not within 2% of expected {expected:.2f} Hz "
        f"(input f0 {f0_in:.2f} Hz)."
    )


def test_time_stretch_preserves_pitch(run_result):
    y_str, _ = librosa.load(STRETCHED_WAV, sr=None, mono=True)
    f0_str = _median_voiced_f0(y_str, SR, fmin=100.0, fmax=400.0)
    rel_err = abs(f0_str - TONE_HZ) / TONE_HZ
    assert rel_err <= 0.02, (
        f"stretched fundamental {f0_str:.2f} Hz not within 2% of input {TONE_HZ} Hz "
        f"(time-stretch must not change pitch)."
    )


def test_transient_report_consistency(run_result):
    data = run_result
    frames = data["transient_frames"]
    times = data["transient_times_seconds"]
    assert isinstance(frames, list) and isinstance(times, list), "transient fields must be arrays."
    assert len(frames) == len(times), "transient_frames and transient_times_seconds must be equal length."
    assert all(isinstance(fr, int) for fr in frames), "transient_frames must be integers."
    assert frames == sorted(frames), "transient_frames must be sorted ascending."
    for fr, tm in zip(frames, times):
        assert abs(float(tm) - fr * HOP / SR) <= 0.001, (
            f"transient time {tm} inconsistent with frame {fr} at hop {HOP} (sr {SR})."
        )


def test_transient_detection_accuracy(run_result):
    data = run_result
    times = [float(t) for t in data["transient_times_seconds"]]
    assert 5 <= len(times) <= 8, (
        f"Expected between 5 and 8 reported transients, got {len(times)}."
    )
    for ct in CLICK_TIMES:
        assert any(abs(t - ct) <= 0.040 for t in times), (
            f"No reported transient within 40 ms of true click at {ct}s. Reported: {times}"
        )
    for t in times:
        assert any(abs(t - ct) <= 0.060 for ct in CLICK_TIMES), (
            f"Spurious transient reported at {t}s (not within 60 ms of any true click)."
        )


def test_transients_survive_time_stretch(run_result):
    y_str, sr = librosa.load(STRETCHED_WAV, sr=None, mono=True)
    onset_times = librosa.onset.onset_detect(
        y=y_str, sr=sr, hop_length=HOP, units="time"
    )
    onset_times = np.asarray(onset_times, dtype=float)
    assert 5 <= len(onset_times) <= 8, (
        f"Expected 5-8 onsets in stretched output, got {len(onset_times)}: {onset_times}"
    )
    for ct in CLICK_TIMES:
        expected = STRETCH_FACTOR * ct
        assert np.any(np.abs(onset_times - expected) <= 0.080), (
            f"No onset within 80 ms of {expected}s (1.5x click {ct}s) in stretched output. "
            f"Detected: {onset_times}"
        )


def test_transients_not_displaced_by_pitch_shift(run_result):
    y_in, _ = librosa.load(INPUT_WAV, sr=None, mono=True)
    y_shift, _ = librosa.load(SHIFTED_WAV, sr=None, mono=True)
    env_in = librosa.onset.onset_strength(y=y_in, sr=SR, hop_length=HOP)
    env_shift = librosa.onset.onset_strength(y=y_shift, sr=SR, hop_length=HOP)
    n = min(len(env_in), len(env_shift))
    a = env_in[:n] - np.mean(env_in[:n])
    b = env_shift[:n] - np.mean(env_shift[:n])
    corr = np.correlate(a, b, mode="full")
    lag = int(np.argmax(corr) - (n - 1))
    assert abs(lag) <= 1, (
        f"Onset envelope cross-correlation lag {lag} frames exceeds +/-1; "
        f"transients were displaced by the pitch shift."
    )
