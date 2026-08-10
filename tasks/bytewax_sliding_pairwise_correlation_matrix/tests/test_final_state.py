import json
import math
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone

import pytest

PROJECT_DIR = "/home/user/project"
INPUT_FILE = os.path.join(PROJECT_DIR, "data", "readings.jsonl")
OUTPUT_FILE = os.path.join(PROJECT_DIR, "output", "correlations.jsonl")

ALIGN = datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
WINDOW_LEN = timedelta(seconds=60)
MIN_OVERLAP = 3
TOL = 1e-6
TS_FMT = "%Y-%m-%dT%H:%M:%SZ"


# --------------------------------------------------------------------------- #
# Independent reference oracle (computed in the test, not from the agent code) #
# --------------------------------------------------------------------------- #
def _parse_ts(ts):
    return datetime.strptime(ts, TS_FMT).replace(tzinfo=timezone.utc)


def _window_index(dt):
    return int((dt - ALIGN) // WINDOW_LEN)


def _pearson(pairs):
    n = len(pairs)
    xs = [p[0] for p in pairs]
    ys = [p[1] for p in pairs]
    mx = sum(xs) / n
    my = sum(ys) / n
    sxy = sum((x - mx) * (y - my) for x, y in pairs)
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    denom = math.sqrt(sxx * syy)
    if denom == 0:
        return None
    return round(sxy / denom, 6)


def _expected_output():
    windows = {}  # idx -> {sensor -> {ts_dt -> value}}
    with open(INPUT_FILE) as f:
        for line in f.read().splitlines():
            if not line.strip():
                continue
            obj = json.loads(line)
            dt = _parse_ts(obj["ts"])
            idx = _window_index(dt)
            windows.setdefault(idx, {}).setdefault(obj["sensor"], {})[dt] = obj["value"]

    results = []
    for idx in sorted(windows):
        by_sensor = windows[idx]
        sensors = sorted(by_sensor)
        correlations = []
        for i in range(len(sensors)):
            for j in range(i + 1, len(sensors)):
                a, b = sensors[i], sensors[j]
                shared = sorted(set(by_sensor[a]) & set(by_sensor[b]))
                if len(shared) < MIN_OVERLAP:
                    continue
                pairs = [(by_sensor[a][ts], by_sensor[b][ts]) for ts in shared]
                correlations.append(
                    {"pair": [a, b], "n": len(shared), "r": _pearson(pairs)}
                )
        if not correlations:
            continue
        open_time = ALIGN + idx * WINDOW_LEN
        close_time = open_time + WINDOW_LEN
        results.append(
            {
                "window_start": open_time.strftime(TS_FMT),
                "window_end": close_time.strftime(TS_FMT),
                "correlations": correlations,
            }
        )
    return results


# --------------------------------------------------------------------------- #
# Fixtures                                                                     #
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def pipeline_output():
    """Run the dataflow fresh and return the parsed output objects."""
    if os.path.exists(OUTPUT_FILE):
        os.remove(OUTPUT_FILE)

    result = subprocess.run(
        [sys.executable, "-m", "bytewax.run", "dataflow:flow"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=300,
    )
    print("STDOUT:\n" + result.stdout)
    print("STDERR:\n" + result.stderr)
    assert result.returncode == 0, (
        f"Pipeline exited with code {result.returncode}; stderr:\n{result.stderr}"
    )
    assert os.path.isfile(OUTPUT_FILE), (
        f"Expected output file {OUTPUT_FILE} to be created by the pipeline."
    )

    objects = []
    with open(OUTPUT_FILE) as f:
        for line in f.read().splitlines():
            if not line.strip():
                continue
            objects.append(json.loads(line))
    return objects


def _sorted_by_start(objs):
    return sorted(objs, key=lambda o: o["window_start"])


# --------------------------------------------------------------------------- #
# Tests                                                                        #
# --------------------------------------------------------------------------- #
def test_line_count_and_window_selection(pipeline_output):
    objs = _sorted_by_start(pipeline_output)
    starts = [o["window_start"] for o in objs]
    assert starts == ["2024-01-01T00:00:00Z", "2024-01-01T00:01:00Z"], (
        f"Expected exactly two windows (A and B) ordered by start; got {starts}. "
        "Window C must be omitted because its only candidate pair has n < 3."
    )
    ends = {o["window_start"]: o["window_end"] for o in objs}
    assert ends["2024-01-01T00:00:00Z"] == "2024-01-01T00:01:00Z", (
        "Window A close time must be open + 60s."
    )
    assert ends["2024-01-01T00:01:00Z"] == "2024-01-01T00:02:00Z", (
        "Window B close time must be open + 60s."
    )


def test_object_and_entry_keys(pipeline_output):
    for o in pipeline_output:
        assert set(o.keys()) == {"window_start", "window_end", "correlations"}, (
            f"Each window object must have exactly keys window_start/window_end/correlations; got {sorted(o.keys())}."
        )
        assert isinstance(o["correlations"], list) and len(o["correlations"]) > 0, (
            "correlations must be a non-empty array for every emitted window."
        )
        for entry in o["correlations"]:
            assert set(entry.keys()) == {"pair", "n", "r"}, (
                f"Each correlation entry must have exactly keys pair/n/r; got {sorted(entry.keys())}."
            )
            assert (
                isinstance(entry["pair"], list) and len(entry["pair"]) == 2
            ), "pair must be a 2-element array."
            assert isinstance(entry["n"], int) and not isinstance(entry["n"], bool), (
                "n must be an integer."
            )


def test_pair_ordering_invariant(pipeline_output):
    for o in pipeline_output:
        pairs = [tuple(e["pair"]) for e in o["correlations"]]
        for a, b in pairs:
            assert a < b, f"Each pair must be in ascending lexicographic order; got {[a, b]}."
        assert pairs == sorted(pairs), (
            f"correlations must be ordered ascending by pair; got {pairs}."
        )


def test_min_overlap_threshold_window_a(pipeline_output):
    objs = {o["window_start"]: o for o in pipeline_output}
    win_a = objs["2024-01-01T00:00:00Z"]
    observed = [(e["pair"][0], e["pair"][1], e["n"]) for e in win_a["correlations"]]
    assert observed == [("s1", "s2", 6), ("s1", "s3", 3), ("s2", "s3", 3)], (
        f"Window A must contain exactly pairs (s1,s2 n=6), (s1,s3 n=3), (s2,s3 n=3); got {observed}. "
        "Any pair involving s4 must be omitted (overlap < 3)."
    )


def test_undefined_and_perfect_negative_window_b(pipeline_output):
    objs = {o["window_start"]: o for o in pipeline_output}
    win_b = objs["2024-01-01T00:01:00Z"]
    by_pair = {tuple(e["pair"]): e for e in win_b["correlations"]}
    assert set(by_pair.keys()) == {("s1", "s2"), ("s1", "s3"), ("s2", "s3")}, (
        f"Window B must contain exactly pairs s1/s2, s1/s3, s2/s3; got {sorted(by_pair.keys())}."
    )
    for pair in [("s1", "s2"), ("s1", "s3"), ("s2", "s3")]:
        assert by_pair[pair]["n"] == 4, f"Pair {pair} in window B must have n = 4."
    assert by_pair[("s1", "s2")]["r"] is None, (
        "r for (s1,s2) in window B must be JSON null because s1 is constant."
    )
    assert by_pair[("s1", "s3")]["r"] is None, (
        "r for (s1,s3) in window B must be JSON null because s1 is constant."
    )
    r_s2_s3 = by_pair[("s2", "s3")]["r"]
    assert r_s2_s3 is not None and abs(r_s2_s3 - (-1.0)) <= TOL, (
        f"r for (s2,s3) in window B must be -1.0 (perfect negative); got {r_s2_s3}."
    )


def test_rounding_invariant(pipeline_output):
    for o in pipeline_output:
        for e in o["correlations"]:
            r = e["r"]
            if r is None:
                continue
            assert abs(r - round(r, 6)) <= 1e-12, (
                f"r={r} is not rounded to 6 decimal places."
            )


def test_matches_independent_reference_oracle(pipeline_output):
    expected = _expected_output()
    actual = _sorted_by_start(pipeline_output)
    assert len(actual) == len(expected), (
        f"Expected {len(expected)} window objects; got {len(actual)}."
    )
    for exp, act in zip(expected, actual):
        assert act["window_start"] == exp["window_start"], (
            f"window_start mismatch: expected {exp['window_start']}, got {act['window_start']}."
        )
        assert act["window_end"] == exp["window_end"], (
            f"window_end mismatch for {exp['window_start']}: expected {exp['window_end']}, got {act['window_end']}."
        )
        exp_corr = exp["correlations"]
        act_corr = act["correlations"]
        assert len(act_corr) == len(exp_corr), (
            f"correlation count mismatch for window {exp['window_start']}: "
            f"expected {len(exp_corr)}, got {len(act_corr)}."
        )
        for ec, ac in zip(exp_corr, act_corr):
            assert ac["pair"] == ec["pair"], (
                f"pair mismatch in window {exp['window_start']}: expected {ec['pair']}, got {ac['pair']}."
            )
            assert ac["n"] == ec["n"], (
                f"n mismatch for pair {ec['pair']} in window {exp['window_start']}: "
                f"expected {ec['n']}, got {ac['n']}."
            )
            if ec["r"] is None:
                assert ac["r"] is None, (
                    f"r for pair {ec['pair']} in window {exp['window_start']} must be null; got {ac['r']}."
                )
            else:
                assert ac["r"] is not None and abs(ac["r"] - ec["r"]) <= TOL, (
                    f"r mismatch for pair {ec['pair']} in window {exp['window_start']}: "
                    f"expected {ec['r']}, got {ac['r']}."
                )
