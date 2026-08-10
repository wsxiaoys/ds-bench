import json
import math
import os
import subprocess
import tempfile

import numpy as np
import pytest
import soundfile as sf

PROJECT_DIR = "/home/user/project"
SCRIPT = os.path.join(PROJECT_DIR, "estimate_downbeats.py")
SR = 22050
START_TIME = 0.25
CLICK_AMP = 1.0
NORMAL_AMP = 0.28
KICK_AMP = 1.2

# (tempo_bpm, meter, num_beats, seed)
CASES = {
    "A_4_4": {"tempo": 120.0, "meter": 4, "num_beats": 60, "seed": 1},
    "B_3_4": {"tempo": 132.0, "meter": 3, "num_beats": 66, "seed": 2},
}


def _synthesize(path, tempo_bpm, meter, num_beats, seed):
    """Create a deterministic mono click-track WAV and return the true beat times.

    Beats that start a bar (every `meter`-th beat) are synthesized louder and
    carry an extra low-frequency percussive "kick"; the remaining beats are
    quiet clicks.
    """
    rng = np.random.default_rng(seed)
    beat_period = 60.0 / tempo_bpm
    total_dur = START_TIME + num_beats * beat_period + 0.2
    n = int(math.ceil(total_dur * SR))
    y = np.zeros(n, dtype=np.float64)

    click_len = int(0.05 * SR)
    tt = np.arange(click_len) / SR
    env = np.exp(-tt * 60.0)
    click = rng.standard_normal(click_len) * env
    click = click / np.max(np.abs(click))
    kick = np.sin(2 * np.pi * 60.0 * tt) * np.exp(-tt * 20.0)
    kick = kick / np.max(np.abs(kick))

    beat_times = START_TIME + np.arange(num_beats) * beat_period
    for i, bt in enumerate(beat_times):
        start = int(round(bt * SR))
        end = min(start + click_len, n)
        m = end - start
        if (i % meter) == 0:
            y[start:end] += CLICK_AMP * click[:m] + KICK_AMP * kick[:m]
        else:
            y[start:end] += NORMAL_AMP * click[:m]

    y = 0.9 * y / np.max(np.abs(y))
    sf.write(path, y.astype(np.float32), SR, subtype="PCM_16")
    return beat_times


def _run_case(name):
    cfg = CASES[name]
    workdir = tempfile.mkdtemp(prefix=f"downbeat_{name}_")
    wav_path = os.path.join(workdir, f"{name}.wav")
    out_path = os.path.join(workdir, f"{name}.json")
    if os.path.exists(out_path):
        os.remove(out_path)

    true_beat_times = _synthesize(
        wav_path, cfg["tempo"], cfg["meter"], cfg["num_beats"], cfg["seed"]
    )

    proc = subprocess.run(
        ["python3", SCRIPT, "--input", wav_path, "--output", out_path],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        timeout=300,
    )
    assert proc.returncode == 0, (
        f"CLI failed for case {name} (rc={proc.returncode}).\n"
        f"stdout:\n{proc.stdout}\nstderr:\n{proc.stderr}"
    )
    assert os.path.isfile(out_path), (
        f"Output JSON {out_path} was not created for case {name}."
    )
    with open(out_path) as f:
        data = json.load(f)
    return data, np.asarray(true_beat_times, dtype=float), cfg


_CACHE = {}


@pytest.fixture(scope="module", params=list(CASES.keys()))
def case(request):
    name = request.param
    if name not in _CACHE:
        _CACHE[name] = _run_case(name)
    data, true_beat_times, cfg = _CACHE[name]
    return name, data, true_beat_times, cfg


def _is_number(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def _is_int_valued(x):
    if isinstance(x, bool):
        return False
    if isinstance(x, int):
        return True
    if isinstance(x, float):
        return float(x).is_integer()
    return False


def test_output_is_object_with_exact_keys(case):
    name, data, _, _ = case
    assert isinstance(data, dict), f"[{name}] Output must be a JSON object, got {type(data)}."
    expected = {"tempo", "beat_times", "meter", "downbeat_indices", "downbeat_times"}
    assert set(data.keys()) == expected, (
        f"[{name}] Output keys must be exactly {sorted(expected)}, got {sorted(data.keys())}."
    )


def test_beat_times_ascending_nonempty(case):
    name, data, _, _ = case
    bt = data["beat_times"]
    assert isinstance(bt, list) and len(bt) > 0, f"[{name}] beat_times must be a non-empty list."
    assert all(_is_number(v) for v in bt), f"[{name}] beat_times must all be numbers."
    assert all(bt[i] < bt[i + 1] for i in range(len(bt) - 1)), (
        f"[{name}] beat_times must be strictly ascending."
    )


def test_meter_matches_ground_truth(case):
    name, data, _, cfg = case
    assert data["meter"] in (2, 3, 4, 6), (
        f"[{name}] meter must be one of 2,3,4,6, got {data['meter']}."
    )
    assert data["meter"] == cfg["meter"], (
        f"[{name}] Estimated meter {data['meter']} != true meter {cfg['meter']}."
    )


def test_tempo_within_tolerance(case):
    name, data, _, cfg = case
    tempo = data["tempo"]
    assert _is_number(tempo), f"[{name}] tempo must be a number, got {tempo!r}."
    rel = abs(tempo - cfg["tempo"]) / cfg["tempo"]
    assert rel <= 0.05, (
        f"[{name}] Estimated tempo {tempo} not within 5% of true tempo {cfg['tempo']} "
        f"(relative error {rel:.4f})."
    )


def test_downbeat_indices_structure(case):
    name, data, _, _ = case
    idx = data["downbeat_indices"]
    n_beats = len(data["beat_times"])
    meter = data["meter"]
    assert isinstance(idx, list) and len(idx) >= 2, (
        f"[{name}] downbeat_indices must be a list with at least 2 entries."
    )
    assert all(_is_int_valued(v) for v in idx), (
        f"[{name}] downbeat_indices must all be integers, got {idx}."
    )
    idx_int = [int(v) for v in idx]
    assert all(0 <= v < n_beats for v in idx_int), (
        f"[{name}] Every downbeat index must be a valid index into beat_times (0..{n_beats - 1}), got {idx_int}."
    )
    assert all(idx_int[i] < idx_int[i + 1] for i in range(len(idx_int) - 1)), (
        f"[{name}] downbeat_indices must be strictly ascending, got {idx_int}."
    )
    diffs = {idx_int[i + 1] - idx_int[i] for i in range(len(idx_int) - 1)}
    assert diffs == {meter}, (
        f"[{name}] Consecutive downbeat indices must differ by meter={meter}; got diffs {sorted(diffs)}."
    )
    assert 0 <= idx_int[0] < meter, (
        f"[{name}] First downbeat index (phase) must be in [0,{meter}), got {idx_int[0]}."
    )


def test_downbeat_times_consistent_with_beat_times(case):
    name, data, _, _ = case
    bt = data["beat_times"]
    idx_int = [int(v) for v in data["downbeat_indices"]]
    dbt = data["downbeat_times"]
    assert isinstance(dbt, list) and len(dbt) == len(idx_int), (
        f"[{name}] downbeat_times length must match downbeat_indices length."
    )
    for k, i in enumerate(idx_int):
        assert abs(dbt[k] - bt[i]) <= 1e-6, (
            f"[{name}] downbeat_times[{k}]={dbt[k]} must equal beat_times[{i}]={bt[i]}."
        )


def test_downbeats_align_to_true_accents(case):
    """Every reported downbeat that lands on a real beat must be an accented
    (bar-starting) beat, and the detected downbeats must cover essentially all
    true accented beats. This rejects a wrong downbeat phase while tolerating a
    couple of edge beats a beat tracker may add/drop at the signal boundaries.
    """
    name, data, true_beat_times, cfg = case
    meter = cfg["meter"]
    beat_period = 60.0 / cfg["tempo"]
    tol = 0.5 * beat_period
    accent_mask = (np.arange(len(true_beat_times)) % meter) == 0
    accent_times = true_beat_times[accent_mask]
    dbt = np.asarray(data["downbeat_times"], dtype=float)
    assert dbt.size > 0, f"[{name}] downbeat_times must be non-empty."

    # (1) No reported downbeat may sit on a true NON-accented beat (wrong phase).
    for d in dbt:
        j = int(np.argmin(np.abs(true_beat_times - d)))
        if abs(true_beat_times[j] - d) <= tol:
            assert accent_mask[j], (
                f"[{name}] Downbeat time {d:.4f}s aligns with true beat index {j} "
                f"which is NOT an accented (bar-starting) beat -> wrong downbeat phase."
            )

    # (2) Coverage: essentially every true accented beat must have a detected
    # downbeat within tolerance (allow up to 2 edge misses).
    covered = 0
    for at in accent_times:
        if float(np.min(np.abs(dbt - at))) <= tol:
            covered += 1
    assert covered >= len(accent_times) - 2, (
        f"[{name}] Only {covered}/{len(accent_times)} true accented beats have a "
        f"detected downbeat within {tol:.4f}s; downbeat coverage is insufficient."
    )
