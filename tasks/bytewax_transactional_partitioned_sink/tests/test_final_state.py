import importlib.metadata
import json
import os
import shutil
import subprocess
import sys
import zlib

import pytest

PROJECT_DIR = "/home/user/project"
EVENTS_FILE = os.path.join(PROJECT_DIR, "events.json")
OUT_DIR = os.path.join(PROJECT_DIR, "out")
RECOVERY_DIR = os.path.join(PROJECT_DIR, "recovery")
NUM_PARTS = 4
REQUIRED_KEYS = {"seq", "key", "value", "running_total"}
TIMEOUT = 180


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def load_events():
    with open(EVENTS_FILE) as f:
        data = json.load(f)
    # Process in ascending seq order (input file is ordered by seq).
    return sorted(data, key=lambda e: e["seq"])


def expected_partition(key):
    return zlib.adler32(key.encode("utf-8")) % NUM_PARTS


def compute_expected(events):
    """Return {seq: expected_record} and {key: partition_index}."""
    running = {}
    expected = {}
    parts = {}
    for e in events:
        key = e["key"]
        running[key] = running.get(key, 0) + e["value"]
        expected[e["seq"]] = {
            "seq": e["seq"],
            "key": key,
            "value": e["value"],
            "running_total": running[key],
        }
        parts[key] = expected_partition(key)
    return expected, parts


def crash_seq(events):
    seqs = sorted(e["seq"] for e in events)
    return seqs[len(seqs) // 2]


def reset_state():
    for d in (OUT_DIR, RECOVERY_DIR):
        if os.path.isdir(d):
            shutil.rmtree(d)
    os.makedirs(RECOVERY_DIR, exist_ok=True)
    result = subprocess.run(
        [sys.executable, "-m", "bytewax.recovery", "recovery", str(NUM_PARTS)],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=TIMEOUT,
    )
    assert result.returncode == 0, (
        f"Failed to initialize recovery partitions: {result.stderr}"
    )


def run_flow(crash_at=None):
    env = os.environ.copy()
    if crash_at is None:
        env.pop("CRASH_AT", None)
    else:
        env["CRASH_AT"] = str(crash_at)
    return subprocess.run(
        [
            sys.executable,
            "-m",
            "bytewax.run",
            "dataflow:flow",
            "-r",
            "recovery",
            "-s",
            "1000",
            "-b",
            "0",
        ],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=TIMEOUT,
        env=env,
    )


def read_partition_files():
    """Return list of (partition_index, record_dict) in file order."""
    records = []
    for i in range(NUM_PARTS):
        path = os.path.join(OUT_DIR, f"part-{i}.jsonl")
        if not os.path.isfile(path):
            continue
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                records.append((i, json.loads(line)))
    return records


def assert_exactly_once_and_correct(events):
    expected, parts = compute_expected(events)
    records = read_partition_files()

    # Each record has exactly the required keys.
    for _, rec in records:
        assert set(rec.keys()) == REQUIRED_KEYS, (
            f"Record has wrong keys {set(rec.keys())}; expected {REQUIRED_KEYS}."
        )

    seqs = [rec["seq"] for _, rec in records]
    # Exactly-once: no duplicates.
    assert len(seqs) == len(set(seqs)), (
        f"Duplicate records detected (exactly-once violated): "
        f"{len(seqs)} rows but {len(set(seqs))} distinct seq values."
    )
    # Completeness: every input event appears exactly once.
    assert set(seqs) == set(expected.keys()), (
        f"Output seq set {sorted(set(seqs))} does not match input seq set "
        f"{sorted(expected.keys())}."
    )

    # Aggregation values and partition placement.
    for part_idx, rec in records:
        exp = expected[rec["seq"]]
        assert rec == exp, f"Record for seq {rec['seq']} was {rec}, expected {exp}."
        assert part_idx == parts[rec["key"]], (
            f"Key '{rec['key']}' record found in partition {part_idx}, "
            f"expected partition {parts[rec['key']]}."
        )

    # Within each partition file, records for each key are in ascending seq order.
    per_file_key_seqs = {}
    for part_idx, rec in records:
        per_file_key_seqs.setdefault((part_idx, rec["key"]), []).append(rec["seq"])
    for (part_idx, key), key_seqs in per_file_key_seqs.items():
        assert key_seqs == sorted(key_seqs), (
            f"Records for key '{key}' in partition {part_idx} are not in ascending "
            f"seq order: {key_seqs}."
        )


# --------------------------------------------------------------------------
# Tests
# --------------------------------------------------------------------------
def test_bytewax_version():
    version = importlib.metadata.version("bytewax")
    assert version == "0.21.1", f"Expected bytewax 0.21.1, found {version}."


def test_clean_run_baseline_correctness():
    events = load_events()
    reset_state()
    result = run_flow(crash_at=None)
    assert result.returncode == 0, (
        f"Clean run exited with {result.returncode}.\nstdout:\n{result.stdout}\n"
        f"stderr:\n{result.stderr}"
    )
    assert_exactly_once_and_correct(events)


def test_crash_produces_durable_partial_output():
    events = load_events()
    reset_state()
    n = crash_seq(events)
    result = run_flow(crash_at=n)
    assert result.returncode != 0, (
        f"Crash run (CRASH_AT={n}) was expected to exit non-zero but exited 0.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    records = read_partition_files()
    assert len(records) >= 1, (
        "Crash run left no durable output; records must be durably written as they "
        "are processed so a crash cannot lose already-written records."
    )
    assert len(records) < len(events), (
        f"Crash run wrote {len(records)} records but the crash should have stopped "
        f"processing before all {len(events)} events were written."
    )


def test_crash_and_resume_exactly_once():
    events = load_events()
    reset_state()
    n = crash_seq(events)

    crash_result = run_flow(crash_at=n)
    assert crash_result.returncode != 0, (
        f"Crash run (CRASH_AT={n}) was expected to exit non-zero but exited 0.\n"
        f"stderr:\n{crash_result.stderr}"
    )

    resume_result = run_flow(crash_at=None)
    assert resume_result.returncode == 0, (
        f"Resume run exited with {resume_result.returncode}.\n"
        f"stdout:\n{resume_result.stdout}\nstderr:\n{resume_result.stderr}"
    )

    assert_exactly_once_and_correct(events)


def test_crash_and_resume_is_deterministic():
    events = load_events()
    n = crash_seq(events)

    def run_scenario():
        reset_state()
        crash_result = run_flow(crash_at=n)
        assert crash_result.returncode != 0, (
            f"Crash run expected to fail, exited 0.\nstderr:\n{crash_result.stderr}"
        )
        resume_result = run_flow(crash_at=None)
        assert resume_result.returncode == 0, (
            f"Resume run failed.\nstderr:\n{resume_result.stderr}"
        )
        return {rec["seq"]: rec for _, rec in read_partition_files()}

    first = run_scenario()
    second = run_scenario()
    assert first == second, (
        "Crash-and-resume did not produce a deterministic exactly-once result "
        "across repetitions."
    )
    assert_exactly_once_and_correct(events)
