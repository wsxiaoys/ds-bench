import glob
import json
import math
import os
import shutil
import sqlite3
import subprocess
from datetime import datetime, timezone

import pytest

PROJECT_DIR = "/home/user/project"
DATA_PATH = os.path.join(PROJECT_DIR, "data", "sensor_readings.jsonl")
RUN_SH = os.path.join(PROJECT_DIR, "run.sh")
OUTPUT_DIR = os.path.join(PROJECT_DIR, "output")
PROFILES_PATH = os.path.join(OUTPUT_DIR, "profiles.jsonl")
ANOMALIES_PATH = os.path.join(OUTPUT_DIR, "anomalies.jsonl")
RECOVERY_DIR = os.path.join(PROJECT_DIR, "recovery")

LENGTH = 60
OFFSET = 30
DEFAULT_THRESHOLD = 3.0
TOL = 1e-6


# --------------------------------------------------------------------------- #
# Independent oracle (recomputes the expected result directly from the input) #
# --------------------------------------------------------------------------- #
def _load_readings():
    readings = []
    with open(DATA_PATH) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            ts = datetime.fromisoformat(rec["ts"])
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            readings.append((rec["sensor_id"], int(ts.timestamp()), float(rec["value"])))
    return readings


def _windows_for(epoch):
    # Half-open sliding windows [s, s + LENGTH), starts aligned to the Unix epoch.
    k_max = epoch // OFFSET
    k_min = (epoch - LENGTH) // OFFSET + 1
    return [OFFSET * k for k in range(k_min, k_max + 1)]


def _compute_expected(threshold):
    readings = _load_readings()
    groups = {}
    for sid, epoch, val in readings:
        for start in _windows_for(epoch):
            groups.setdefault((sid, start), []).append((epoch, val))

    profiles = {}
    anomalies = {}
    for (sid, start), items in groups.items():
        vals = [v for _, v in items]
        n = len(vals)
        mean = sum(vals) / n
        var = sum((x - mean) ** 2 for x in vals) / n
        std = math.sqrt(var)
        profiles[(sid, start)] = {
            "window_end": start + LENGTH,
            "count": n,
            "mean": mean,
            "variance": var,
            "std": std,
        }
        for epoch, val in items:
            z = 0.0 if std == 0.0 else (val - mean) / std
            if abs(z) > threshold:
                anomalies[(sid, start, epoch)] = {"value": val, "zscore": z}
    return profiles, anomalies


def _at_most_6_decimals(x):
    return round(float(x), 6) == float(x)


def _read_jsonl(path):
    if not os.path.isfile(path):
        return []
    out = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            out.append(json.loads(line))
    return out


def _count_snaps(recovery_dir):
    total = 0
    part_files = glob.glob(os.path.join(recovery_dir, "part-*.sqlite3"))
    for path in part_files:
        con = sqlite3.connect(path)
        try:
            names = {
                row[0]
                for row in con.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()
            }
            if "snaps" in names:
                total += con.execute("SELECT COUNT(*) FROM snaps").fetchone()[0]
        finally:
            con.close()
    return len(part_files), total


def _run_pipeline(threshold=None, timeout=300):
    # Exercise the run from a fully clean state so the check is deterministic.
    for p in (PROFILES_PATH, ANOMALIES_PATH):
        if os.path.isfile(p):
            os.remove(p)
    if os.path.isdir(RECOVERY_DIR):
        shutil.rmtree(RECOVERY_DIR)

    env = os.environ.copy()
    env.pop("ZSCORE_THRESHOLD", None)
    if threshold is not None:
        env["ZSCORE_THRESHOLD"] = str(threshold)

    proc = subprocess.run(
        ["bash", RUN_SH],
        cwd=PROJECT_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    part_count, snaps = _count_snaps(RECOVERY_DIR)
    return {
        "returncode": proc.returncode,
        "stdout": proc.stdout,
        "stderr": proc.stderr,
        "profiles": _read_jsonl(PROFILES_PATH),
        "anomalies": _read_jsonl(ANOMALIES_PATH),
        "part_count": part_count,
        "snaps": snaps,
        "profiles_exists": os.path.isfile(PROFILES_PATH),
    }


@pytest.fixture(scope="session")
def default_run():
    assert os.path.isfile(RUN_SH), f"Entrypoint script {RUN_SH} does not exist."
    result = _run_pipeline(threshold=None)
    return result


# --------------------------------------------------------------------------- #
# Tests                                                                        #
# --------------------------------------------------------------------------- #
def test_run_exits_zero_and_produces_profiles(default_run):
    assert default_run["returncode"] == 0, (
        f"'bash run.sh' must exit 0. stderr:\n{default_run['stderr']}"
    )
    assert default_run["profiles_exists"], (
        f"Profiles output file {PROFILES_PATH} was not created."
    )
    assert len(default_run["profiles"]) > 0, "Profiles output file is empty."
    assert default_run["part_count"] > 0, (
        f"No recovery partition files (part-*.sqlite3) found under {RECOVERY_DIR}."
    )


def test_recovery_snapshots_persisted(default_run):
    assert default_run["part_count"] > 0, (
        f"No recovery partition files found under {RECOVERY_DIR}; "
        "recovery does not appear to be enabled."
    )
    assert default_run["snaps"] > 0, (
        "The recovery partitions contain no state snapshots (empty 'snaps' table). "
        "The dataflow must run with SQLite recovery enabled and picklable state."
    )


def test_profiles_are_correct(default_run):
    expected, _ = _compute_expected(DEFAULT_THRESHOLD)
    emitted_rows = default_run["profiles"]

    emitted = {}
    for row in emitted_rows:
        assert set(row.keys()) == {
            "sensor_id",
            "window_start",
            "window_end",
            "count",
            "mean",
            "variance",
            "std",
        }, f"Profile object has unexpected keys: {sorted(row.keys())}"
        key = (row["sensor_id"], int(row["window_start"]))
        assert key not in emitted, f"Duplicate profile emitted for {key}."
        emitted[key] = row

    assert set(emitted.keys()) == set(expected.keys()), (
        "The set of (sensor_id, window_start) profile windows does not match the "
        "set of windows containing at least one reading.\n"
        f"missing={set(expected) - set(emitted)}\n"
        f"unexpected={set(emitted) - set(expected)}"
    )

    for key, exp in expected.items():
        row = emitted[key]
        assert int(row["window_end"]) == exp["window_end"], (
            f"window_end for {key} should be window_start + {LENGTH}."
        )
        assert int(row["count"]) == exp["count"], (
            f"count mismatch for {key}: got {row['count']} expected {exp['count']}."
        )
        for field in ("mean", "variance", "std"):
            got = float(row[field])
            assert abs(got - exp[field]) <= TOL, (
                f"{field} mismatch for {key}: got {got} expected ~{exp[field]}."
            )
            assert _at_most_6_decimals(row[field]), (
                f"{field} for {key} is not rounded to 6 decimal places: {row[field]}."
            )


def test_profiles_cover_edge_cases(default_run):
    # Grounded in truth: a constant-valued sensor yields std==0 windows, and an
    # isolated single reading yields a count==1 / std==0 window.
    profiles = default_run["profiles"]
    assert any(
        abs(float(p["variance"])) <= TOL and abs(float(p["std"])) <= TOL
        for p in profiles
    ), "Expected at least one window with variance == 0 and std == 0."
    assert any(
        int(p["count"]) == 1
        and abs(float(p["variance"])) <= TOL
        and abs(float(p["std"])) <= TOL
        for p in profiles
    ), "Expected at least one single-reading window (count == 1, std == 0)."


def test_anomalies_are_correct(default_run):
    _, expected = _compute_expected(DEFAULT_THRESHOLD)
    emitted_rows = default_run["anomalies"]

    emitted = {}
    for row in emitted_rows:
        assert set(row.keys()) == {
            "sensor_id",
            "ts",
            "value",
            "window_start",
            "zscore",
        }, f"Anomaly object has unexpected keys: {sorted(row.keys())}"
        key = (row["sensor_id"], int(row["window_start"]), int(row["ts"]))
        assert key not in emitted, f"Duplicate anomaly emitted for {key}."
        emitted[key] = row

    assert set(emitted.keys()) == set(expected.keys()), (
        "The emitted anomaly set does not match the recomputed set at threshold "
        f"{DEFAULT_THRESHOLD}.\n"
        f"missing={set(expected) - set(emitted)}\n"
        f"unexpected={set(emitted) - set(expected)}"
    )

    for key, exp in expected.items():
        row = emitted[key]
        assert abs(float(row["value"]) - exp["value"]) <= TOL, (
            f"value mismatch for {key}."
        )
        assert abs(float(row["zscore"]) - exp["zscore"]) <= TOL, (
            f"zscore mismatch for {key}: got {row['zscore']} expected ~{exp['zscore']}."
        )
        assert _at_most_6_decimals(row["zscore"]), (
            f"zscore for {key} is not rounded to 6 decimal places: {row['zscore']}."
        )


def test_anomalies_respect_sliding_window_overlap(default_run):
    emitted_rows = default_run["anomalies"]
    assert len(emitted_rows) > 0, (
        "Expected at least one anomaly at the default threshold."
    )
    by_reading = {}
    for row in emitted_rows:
        by_reading.setdefault(
            (row["sensor_id"], int(row["ts"])), set()
        ).add(int(row["window_start"]))
    assert any(len(windows) >= 2 for windows in by_reading.values()), (
        "Expected at least one reading flagged as an anomaly in two overlapping "
        "windows (sliding-window overlap semantics)."
    )

    # No anomaly may come from a zero-variance (constant) window.
    expected_profiles, _ = _compute_expected(DEFAULT_THRESHOLD)
    for row in emitted_rows:
        key = (row["sensor_id"], int(row["window_start"]))
        std = expected_profiles[key]["std"]
        assert std > 0.0, (
            f"Anomaly reported for a zero-std window {key}; this must never happen."
        )


def test_threshold_is_configurable(default_run):
    _, expected_default = _compute_expected(DEFAULT_THRESHOLD)

    result = _run_pipeline(threshold=2.0)
    assert result["returncode"] == 0, (
        f"'bash run.sh' with ZSCORE_THRESHOLD=2.0 must exit 0. stderr:\n{result['stderr']}"
    )
    _, expected_low = _compute_expected(2.0)

    emitted = {}
    for row in result["anomalies"]:
        key = (row["sensor_id"], int(row["window_start"]), int(row["ts"]))
        emitted[key] = row
    assert set(emitted.keys()) == set(expected_low.keys()), (
        "Anomaly set at threshold 2.0 does not match the recomputed set.\n"
        f"missing={set(expected_low) - set(emitted)}\n"
        f"unexpected={set(emitted) - set(expected_low)}"
    )
    assert set(expected_default.keys()).issubset(set(expected_low.keys())), (
        "Lowering the threshold must not drop any previously-detected anomaly."
    )
    assert len(expected_low) > len(expected_default), (
        "Lowering the threshold to 2.0 must produce strictly more anomalies than "
        "the default threshold 3.0 for the seeded data."
    )
