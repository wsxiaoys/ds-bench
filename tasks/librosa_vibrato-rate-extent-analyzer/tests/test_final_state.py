import json
import os
import subprocess

import numpy as np
import pytest
import soundfile as sf

PROJECT_DIR = "/home/user/vibrato_analyzer"
SCRIPT = "analyze_vibrato.py"

SR = 22050
SILENCE_S = 0.3
RNG_SEED = 0

REQUIRED_KEYS = {
    "start_time",
    "end_time",
    "has_vibrato",
    "vibrato_rate_hz",
    "vibrato_extent_cents",
}

# Deterministic note plan. Times are derived below by concatenation; the
# midpoints / expected values here mirror the `truth` verification plan.
NOTE_PLAN = [
    # name, f_center, duration_s, vib_rate_hz, vib_amp_cents, glide_cents
    ("A", 220.0, 3.0, 5.0, 50.0, 150.0),
    ("B", 330.0, 3.0, 6.5, 50.0, 0.0),
    ("C", 262.0, 2.5, 0.0, 0.0, 0.0),
]

RATE_TOL_HZ = 0.5
EXTENT_TOL_CENTS = 15.0
EXPECTED_PP_EXTENT_CENTS = 100.0  # +/-50 cents amplitude -> 100 cents peak-to-peak


def _synth_note(f_center, duration_s, vib_rate_hz, vib_amp_cents, glide_cents, rng):
    n = int(round(duration_s * SR))
    t = np.arange(n) / SR
    mod_cents = np.zeros(n)
    if vib_amp_cents > 0 and vib_rate_hz > 0:
        mod_cents += vib_amp_cents * np.sin(2.0 * np.pi * vib_rate_hz * t)
    if glide_cents != 0.0:
        mod_cents += np.linspace(0.0, glide_cents, n)
    f_inst = f_center * np.power(2.0, mod_cents / 1200.0)
    phase = 2.0 * np.pi * np.cumsum(f_inst) / SR
    y = np.sin(phase) + 0.3 * np.sin(2.0 * phase) + 0.15 * np.sin(3.0 * phase)
    y *= 0.5
    y += 0.01 * rng.standard_normal(n)
    return y.astype(np.float64)


def _build_signal():
    """Concatenate the three notes with silent gaps and return (audio, notes).

    notes: list of dicts with name, start, end, midpoint and expectations.
    """
    rng = np.random.default_rng(RNG_SEED)
    silence = np.zeros(int(round(SILENCE_S * SR)), dtype=np.float64)
    chunks = []
    notes = []
    cursor_samples = 0
    for idx, (name, f_center, dur, rate, amp, glide) in enumerate(NOTE_PLAN):
        y = _synth_note(f_center, dur, rate, amp, glide, rng)
        start_s = cursor_samples / SR
        end_s = (cursor_samples + len(y)) / SR
        notes.append(
            {
                "name": name,
                "start": start_s,
                "end": end_s,
                "midpoint": 0.5 * (start_s + end_s),
                "has_vibrato": amp > 0 and rate > 0,
                "rate_hz": rate,
            }
        )
        chunks.append(y)
        cursor_samples += len(y)
        if idx != len(NOTE_PLAN) - 1:
            chunks.append(silence)
            cursor_samples += len(silence)
    audio = np.concatenate(chunks)
    return audio, notes


def _run_analyzer(input_path, output_path):
    if os.path.exists(output_path):
        os.remove(output_path)
    result = subprocess.run(
        ["python3", SCRIPT, "--input", input_path, "--output", output_path],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
    )
    return result


@pytest.fixture(scope="session")
def input_wav(tmp_path_factory):
    audio, notes = _build_signal()
    path = str(tmp_path_factory.mktemp("vib") / "vib_input.wav")
    sf.write(path, audio, SR, subtype="PCM_16")
    return path, notes


@pytest.fixture(scope="session")
def analyzer_output(input_wav, tmp_path_factory):
    input_path, notes = input_wav
    output_path = str(tmp_path_factory.mktemp("vibout") / "vib_output.json")
    result = _run_analyzer(input_path, output_path)
    assert result.returncode == 0, (
        f"analyze_vibrato.py exited with code {result.returncode}. "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    assert os.path.isfile(output_path), (
        f"Output JSON was not created at {output_path}."
    )
    with open(output_path) as f:
        data = json.load(f)
    return data, notes


def _match_segment(segments, midpoint):
    matched = [
        s
        for s in segments
        if float(s["start_time"]) <= midpoint <= float(s["end_time"])
    ]
    return matched


def test_script_exists():
    script_path = os.path.join(PROJECT_DIR, SCRIPT)
    assert os.path.isfile(script_path), (
        f"Expected the analyzer at {script_path}."
    )


def test_output_is_sorted_array_of_three(analyzer_output):
    data, _notes = analyzer_output
    assert isinstance(data, list), "Output JSON must be a top-level array."
    assert len(data) == 3, (
        f"Expected exactly 3 note segments, got {len(data)}: {data}"
    )
    starts = [float(s["start_time"]) for s in data]
    assert starts == sorted(starts), (
        f"Segments must be ordered by ascending start_time, got {starts}."
    )


def test_segment_schema(analyzer_output):
    data, _notes = analyzer_output
    for seg in data:
        assert isinstance(seg, dict), f"Each segment must be an object, got {seg!r}."
        assert set(seg.keys()) == REQUIRED_KEYS, (
            f"Segment keys must be exactly {sorted(REQUIRED_KEYS)}, "
            f"got {sorted(seg.keys())}."
        )
        assert float(seg["start_time"]) < float(seg["end_time"]), (
            f"start_time must be < end_time for segment {seg}."
        )
        assert isinstance(seg["has_vibrato"], bool), (
            f"has_vibrato must be a boolean, got {seg['has_vibrato']!r}."
        )


def test_each_note_matched_by_one_segment(analyzer_output):
    data, notes = analyzer_output
    for note in notes:
        matched = _match_segment(data, note["midpoint"])
        assert len(matched) == 1, (
            f"Note {note['name']} (midpoint {note['midpoint']:.3f}s) should be "
            f"covered by exactly one segment, matched {len(matched)}: {matched}"
        )


def test_note_a_vibrato_rate_and_extent(analyzer_output):
    data, notes = analyzer_output
    note = next(n for n in notes if n["name"] == "A")
    seg = _match_segment(data, note["midpoint"])[0]
    assert seg["has_vibrato"] is True, (
        f"Note A must be classified as vibrato, got {seg}."
    )
    rate = float(seg["vibrato_rate_hz"])
    assert abs(rate - 5.0) <= RATE_TOL_HZ, (
        f"Note A vibrato_rate_hz expected 5.0 +/- {RATE_TOL_HZ}, got {rate}."
    )
    extent = float(seg["vibrato_extent_cents"])
    assert abs(extent - EXPECTED_PP_EXTENT_CENTS) <= EXTENT_TOL_CENTS, (
        f"Note A vibrato_extent_cents expected {EXPECTED_PP_EXTENT_CENTS} +/- "
        f"{EXTENT_TOL_CENTS} (slow +150 cent glide must be detrended away), got {extent}."
    )


def test_note_b_vibrato_rate_and_extent(analyzer_output):
    data, notes = analyzer_output
    note = next(n for n in notes if n["name"] == "B")
    seg = _match_segment(data, note["midpoint"])[0]
    assert seg["has_vibrato"] is True, (
        f"Note B must be classified as vibrato, got {seg}."
    )
    rate = float(seg["vibrato_rate_hz"])
    assert abs(rate - 6.5) <= RATE_TOL_HZ, (
        f"Note B vibrato_rate_hz expected 6.5 +/- {RATE_TOL_HZ}, got {rate}."
    )
    extent = float(seg["vibrato_extent_cents"])
    assert abs(extent - EXPECTED_PP_EXTENT_CENTS) <= EXTENT_TOL_CENTS, (
        f"Note B vibrato_extent_cents expected {EXPECTED_PP_EXTENT_CENTS} +/- "
        f"{EXTENT_TOL_CENTS}, got {extent}."
    )


def test_note_c_no_vibrato(analyzer_output):
    data, notes = analyzer_output
    note = next(n for n in notes if n["name"] == "C")
    seg = _match_segment(data, note["midpoint"])[0]
    assert seg["has_vibrato"] is False, (
        f"Note C (steady pitch) must be classified as no-vibrato, got {seg}."
    )
    extent = seg["vibrato_extent_cents"]
    if extent is not None:
        assert float(extent) < 20.0, (
            f"Note C should have a small vibrato_extent_cents (<20), got {extent}."
        )


def test_deterministic_rerun(input_wav, tmp_path_factory):
    input_path, _notes = input_wav
    out1 = str(tmp_path_factory.mktemp("det1") / "o1.json")
    out2 = str(tmp_path_factory.mktemp("det2") / "o2.json")
    r1 = _run_analyzer(input_path, out1)
    r2 = _run_analyzer(input_path, out2)
    assert r1.returncode == 0 and r2.returncode == 0, (
        "Both analyzer runs must exit 0 for the determinism check."
    )
    with open(out1) as f:
        d1 = json.load(f)
    with open(out2) as f:
        d2 = json.load(f)
    assert len(d1) == len(d2), "Re-running must yield the same number of segments."
    for a, b in zip(d1, d2):
        assert a["has_vibrato"] == b["has_vibrato"], (
            f"has_vibrato differs between runs: {a} vs {b}."
        )
        for key in ("vibrato_rate_hz", "vibrato_extent_cents"):
            va, vb = a[key], b[key]
            if va is None or vb is None:
                assert va == vb, f"{key} differs between runs: {va} vs {vb}."
            else:
                assert abs(float(va) - float(vb)) <= 1e-6, (
                    f"{key} not deterministic across runs: {va} vs {vb}."
                )
