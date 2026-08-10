import json
import math
import os
import subprocess
import sys
from datetime import datetime, timezone

import pytest

PROJECT_DIR = "/home/user/project"
INPUT_FILE = os.path.join(PROJECT_DIR, "data", "events.jsonl")
TOPK_FILE = os.path.join(PROJECT_DIR, "out", "topk.jsonl")
TRENDING_FILE = os.path.join(PROJECT_DIR, "out", "trending.jsonl")

ALIGN_TO = datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
WINDOW_SECONDS = 60
N = 3
K = 3
TREND_THRESHOLD = 5


# --------------------------------------------------------------------------
# Independent reference oracle computed directly from the raw input events.
# --------------------------------------------------------------------------
def _window_id(ts_str):
    ts = datetime.fromisoformat(ts_str)
    delta = (ts - ALIGN_TO).total_seconds()
    return int(math.floor(delta / WINDOW_SECONDS))


def _read_events():
    with open(INPUT_FILE) as f:
        lines = [ln for ln in f.read().splitlines() if ln.strip()]
    return [json.loads(ln) for ln in lines]


def _compute_reference():
    events = _read_events()

    # counts[item][window_id] = number of events
    counts = {}
    for ev in events:
        item = ev["item"]
        w = _window_id(ev["ts"])
        counts.setdefault(item, {})
        counts[item][w] = counts[item].get(w, 0) + 1

    expected_trending = []
    final_rolling_total = {}

    for item, per_window in counts.items():
        # Time-ordered sequence of (window_id, count) for non-empty windows.
        seq = sorted(per_window.items())

        # Trending: growth vs the item's previous recorded window result.
        for i in range(1, len(seq)):
            w, c = seq[i]
            _, prev_c = seq[i - 1]
            growth = c - prev_c
            if growth > TREND_THRESHOLD:
                expected_trending.append(
                    {
                        "item": item,
                        "window": w,
                        "count": c,
                        "prev_count": prev_c,
                        "growth": growth,
                    }
                )

        # Rolling total = sum of counts over the last up-to-N recorded windows.
        last_n = seq[-N:]
        final_rolling_total[item] = sum(c for _, c in last_n)

    # Global top-K by rolling total desc, tie-break item name asc.
    ranked = sorted(final_rolling_total.items(), key=lambda kv: (-kv[1], kv[0]))
    expected_topk = []
    for idx, (item, total) in enumerate(ranked[:K], start=1):
        expected_topk.append({"rank": idx, "item": item, "rolling_total": total})

    return expected_topk, expected_trending


def _parse_jsonl(path):
    with open(path) as f:
        lines = [ln for ln in f.read().splitlines() if ln.strip()]
    return [json.loads(ln) for ln in lines]


def _freeze(obj):
    return tuple(sorted(obj.items()))


@pytest.fixture(scope="module")
def pipeline_run():
    # Clean any stale outputs so we verify a fresh run.
    for path in (TOPK_FILE, TRENDING_FILE):
        if os.path.exists(path):
            os.remove(path)

    result = subprocess.run(
        [sys.executable, "-m", "bytewax.run", "pipeline:flow"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    print("STDOUT:\n", result.stdout)
    print("STDERR:\n", result.stderr)
    return result


def test_pipeline_exits_zero(pipeline_run):
    assert pipeline_run.returncode == 0, (
        f"'python -m bytewax.run pipeline:flow' failed with code "
        f"{pipeline_run.returncode}. Stderr:\n{pipeline_run.stderr}"
    )


def test_output_files_exist(pipeline_run):
    assert os.path.isfile(TOPK_FILE), f"Expected top-k output file {TOPK_FILE} to exist."
    assert os.path.isfile(TRENDING_FILE), (
        f"Expected trending output file {TRENDING_FILE} to exist."
    )


def test_topk_matches_reference(pipeline_run):
    expected_topk, _ = _compute_reference()
    actual = _parse_jsonl(TOPK_FILE)

    # Every object must carry exactly the required keys.
    for obj in actual:
        assert set(obj.keys()) == {"rank", "item", "rolling_total"}, (
            f"top-k object has unexpected keys: {obj}. "
            "Required keys are exactly 'rank', 'item', 'rolling_total'."
        )

    assert len(actual) == len(expected_topk), (
        f"Expected {len(expected_topk)} top-k rows, found {len(actual)}: {actual}"
    )

    actual_by_rank = {o["rank"]: o for o in actual}
    expected_by_rank = {o["rank"]: o for o in expected_topk}

    assert set(actual_by_rank.keys()) == set(expected_by_rank.keys()), (
        f"Top-k ranks mismatch. Expected ranks {sorted(expected_by_rank)}, "
        f"got {sorted(actual_by_rank)}."
    )

    for rank, exp in expected_by_rank.items():
        got = actual_by_rank[rank]
        assert got["item"] == exp["item"], (
            f"Top-k rank {rank}: expected item {exp['item']!r}, got {got['item']!r} "
            f"(full expected {expected_topk})."
        )
        assert got["rolling_total"] == exp["rolling_total"], (
            f"Top-k rank {rank} ({exp['item']}): expected rolling_total "
            f"{exp['rolling_total']}, got {got['rolling_total']}."
        )


def test_trending_matches_reference(pipeline_run):
    _, expected_trending = _compute_reference()
    actual = _parse_jsonl(TRENDING_FILE)

    for obj in actual:
        assert set(obj.keys()) == {"item", "window", "count", "prev_count", "growth"}, (
            f"trending object has unexpected keys: {obj}. Required keys are exactly "
            "'item', 'window', 'count', 'prev_count', 'growth'."
        )

    actual_set = {_freeze(o) for o in actual}
    expected_set = {_freeze(o) for o in expected_trending}

    assert len(actual) == len(actual_set), (
        f"Duplicate rows found in trending output: {actual}"
    )
    assert actual_set == expected_set, (
        f"Trending output mismatch.\nExpected: {sorted(expected_trending, key=str)}\n"
        f"Got: {sorted(actual, key=str)}"
    )


def test_output_line_counts(pipeline_run):
    expected_topk, expected_trending = _compute_reference()
    actual_topk = _parse_jsonl(TOPK_FILE)
    actual_trending = _parse_jsonl(TRENDING_FILE)
    assert len(actual_topk) == len(expected_topk), (
        f"{TOPK_FILE} must contain exactly {len(expected_topk)} lines, "
        f"found {len(actual_topk)}."
    )
    assert len(actual_trending) == len(expected_trending), (
        f"{TRENDING_FILE} must contain exactly {len(expected_trending)} lines, "
        f"found {len(actual_trending)}."
    )
