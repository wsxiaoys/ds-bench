import json
import os
import subprocess

import numpy as np
import pytest
import soundfile as sf

PROJECT_DIR = "/home/user/project"
SCRIPT = os.path.join(PROJECT_DIR, "shape_transients.py")

IN_WAV = os.path.join(PROJECT_DIR, "_verify_in.wav")
OUT_WAV = os.path.join(PROJECT_DIR, "_verify_out.wav")
REPORT = os.path.join(PROJECT_DIR, "_verify_report.json")

SR = 22050
DUR = 3.2
GT = [0.5, 1.1, 1.8, 2.6]
PEAKS = [0.40, 0.35, 0.40, 0.30]
ATTACK_RISE_MS = 3.0
TAU = 0.06
PARTIALS = [110.0, 220.0]

ATTACK_GAIN_DB = 6.0
SUSTAIN_GAIN_DB = -6.0
ATTACK_MS = 30.0
CROSSFADE_MS = 5.0

# Measurement geometry (samples)
A_SAMP = int(round(ATTACK_MS / 1000 * SR))
CF_SAMP = int(round(CROSSFADE_MS / 1000 * SR))
GUARD = CF_SAMP + int(round(0.002 * SR))  # crossfade half-width + 2 ms margin

ONSET_TOL_S = 0.06
ENERGY_REL_TOL = 0.10

EXP_ATTACK_RATIO = 10 ** (ATTACK_GAIN_DB / 10)   # power ratio ~3.981
EXP_SUSTAIN_RATIO = 10 ** (SUSTAIN_GAIN_DB / 10)  # power ratio ~0.251
ATTACK_AMP = 10 ** (ATTACK_GAIN_DB / 20)          # amplitude gain ~1.995


def _synthesize():
    n = int(round(DUR * SR))
    x = np.zeros(n, dtype=np.float64)
    hit_len = int(round(0.45 * SR))
    rise = int(round(ATTACK_RISE_MS / 1000 * SR))
    t = np.arange(hit_len) / SR
    env = np.empty(hit_len)
    env[:rise] = 0.5 * (1 - np.cos(np.pi * np.arange(rise) / rise))
    env[rise:] = np.exp(-(np.arange(hit_len - rise)) / (TAU * SR))
    carrier = np.zeros(hit_len)
    for f in PARTIALS:
        carrier += np.sin(2 * np.pi * f * t)
    base = env * carrier
    base = base / np.max(np.abs(base))
    for gt, pk in zip(GT, PEAKS):
        s = int(round(gt * SR))
        seg = pk * base
        end = min(hit_len, n - s)
        x[s:s + end] += seg[:end]
    return x.astype(np.float32)


@pytest.fixture(scope="module")
def run_tool():
    for p in (IN_WAV, OUT_WAV, REPORT):
        if os.path.exists(p):
            os.remove(p)
    assert os.path.isfile(SCRIPT), f"Solution script not found at {SCRIPT}."
    x = _synthesize()
    sf.write(IN_WAV, x, SR, subtype="FLOAT")

    result = subprocess.run(
        [
            "python3", SCRIPT,
            "--input", IN_WAV,
            "--output", OUT_WAV,
            "--report", REPORT,
            "--attack-gain-db", str(ATTACK_GAIN_DB),
            "--sustain-gain-db", str(SUSTAIN_GAIN_DB),
            "--attack-ms", str(ATTACK_MS),
            "--crossfade-ms", str(CROSSFADE_MS),
        ],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
    )
    print("STDOUT:\n", result.stdout)
    print("STDERR:\n", result.stderr)
    assert result.returncode == 0, (
        f"shape_transients.py exited with {result.returncode}. Stderr: {result.stderr}"
    )
    return x


def _load_output():
    y, sr_out = sf.read(OUT_WAV, dtype="float64", always_2d=False)
    if y.ndim > 1:
        y = y[:, 0]
    return y, sr_out


def _load_report():
    with open(REPORT) as f:
        return json.load(f)


def _matched_onsets(report):
    """Return reported onset times matched one-to-one to GT within tolerance."""
    onsets = [o["onset_time"] for o in report["onsets"]]
    onsets_sorted = sorted(onsets)
    matched = []
    remaining = list(onsets_sorted)
    for gt in GT:
        best = min(remaining, key=lambda v: abs(v - gt))
        assert abs(best - gt) <= ONSET_TOL_S, (
            f"No reported onset within {ONSET_TOL_S}s of ground-truth {gt}s; closest={best}s."
        )
        matched.append(best)
        remaining.remove(best)
    return onsets_sorted, matched


def test_outputs_exist(run_tool):
    assert os.path.isfile(OUT_WAV), f"Output WAV {OUT_WAV} was not created."
    assert os.path.isfile(REPORT), f"Report JSON {REPORT} was not created."


def test_length_and_samplerate_preserved(run_tool):
    x = run_tool
    y, sr_out = _load_output()
    assert sr_out == SR, f"Output sample rate {sr_out} != input {SR}."
    assert len(y) == len(x), (
        f"Output length {len(y)} != input length {len(x)}."
    )


def test_report_schema_and_values(run_tool):
    report = _load_report()
    assert report["sample_rate"] == SR, (
        f"report sample_rate {report.get('sample_rate')} != {SR}."
    )
    assert abs(report["attack_gain_db"] - ATTACK_GAIN_DB) <= 1e-6, (
        "Top-level attack_gain_db does not match CLI value."
    )
    assert abs(report["sustain_gain_db"] - SUSTAIN_GAIN_DB) <= 1e-6, (
        "Top-level sustain_gain_db does not match CLI value."
    )
    onsets = report["onsets"]
    assert isinstance(onsets, list) and len(onsets) > 0, "onsets must be a non-empty list."
    times = [o["onset_time"] for o in onsets]
    assert times == sorted(times), "onsets must be ordered by ascending onset_time."
    assert report["num_transients"] == len(onsets), (
        "num_transients must equal len(onsets)."
    )
    for o in onsets:
        assert abs(o["attack_gain_db"] - ATTACK_GAIN_DB) <= 1e-6, (
            "Per-onset attack_gain_db must equal the CLI attack gain."
        )
        assert abs(o["sustain_gain_db"] - SUSTAIN_GAIN_DB) <= 1e-6, (
            "Per-onset sustain_gain_db must equal the CLI sustain gain."
        )


def test_onset_accuracy(run_tool):
    report = _load_report()
    assert len(report["onsets"]) == len(GT), (
        f"Expected {len(GT)} detected transients, got {len(report['onsets'])}."
    )
    _matched_onsets(report)  # asserts one-to-one match within tolerance


def test_attack_energy_boosted(run_tool):
    x = run_tool
    y, _ = _load_output()
    report = _load_report()
    onsets_sorted, _ = _matched_onsets(report)
    for t0 in onsets_sorted:
        s = int(round(t0 * SR))
        win = slice(s + GUARD, s + A_SAMP - GUARD)
        num = float(np.sum(y[win] ** 2))
        den = float(np.sum(x[win] ** 2))
        assert den > 0, f"No input energy in attack window for onset {t0}s."
        ratio = num / den
        assert abs(ratio - EXP_ATTACK_RATIO) / EXP_ATTACK_RATIO <= ENERGY_REL_TOL, (
            f"Attack power ratio {ratio:.3f} not within {ENERGY_REL_TOL*100:.0f}% "
            f"of expected {EXP_ATTACK_RATIO:.3f} at onset {t0}s."
        )


def test_sustain_energy_cut(run_tool):
    x = run_tool
    y, _ = _load_output()
    report = _load_report()
    onsets_sorted, _ = _matched_onsets(report)
    for i, t0 in enumerate(onsets_sorted):
        s = int(round(t0 * SR))
        s_next = int(round(onsets_sorted[i + 1] * SR)) if i + 1 < len(onsets_sorted) else len(x)
        win = slice(s + A_SAMP + GUARD, s_next - GUARD)
        num = float(np.sum(y[win] ** 2))
        den = float(np.sum(x[win] ** 2))
        assert den > 0, f"No input energy in sustain window for onset {t0}s."
        ratio = num / den
        assert abs(ratio - EXP_SUSTAIN_RATIO) / EXP_SUSTAIN_RATIO <= ENERGY_REL_TOL, (
            f"Sustain power ratio {ratio:.3f} not within {ENERGY_REL_TOL*100:.0f}% "
            f"of expected {EXP_SUSTAIN_RATIO:.3f} at onset {t0}s."
        )


def test_no_clipping(run_tool):
    y, _ = _load_output()
    assert np.max(np.abs(y)) <= 1.0 + 1e-6, (
        f"Output clips: max abs sample {np.max(np.abs(y))} > 1.0."
    )


def test_no_clicks(run_tool):
    x = run_tool
    y, _ = _load_output()
    d_in = float(np.max(np.abs(np.diff(x.astype(np.float64)))))
    d_out = float(np.max(np.abs(np.diff(y))))
    threshold = 4.0 * ATTACK_AMP * d_in
    assert d_out <= threshold, (
        f"Output has a discontinuity/click: max |y[n+1]-y[n]|={d_out:.4f} exceeds "
        f"threshold {threshold:.4f} (indicates a non-crossfaded gain switch)."
    )
