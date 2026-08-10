import json
import os
import shutil
import subprocess
import sys

import pytest

PROJECT_DIR = "/home/user/etl_router"
DATA_DIR = os.path.join(PROJECT_DIR, "data")
INPUT_FILE = os.path.join(DATA_DIR, "input.jsonl")
OUT_DIR = os.path.join(PROJECT_DIR, "out")

CATEGORY_FILES = {
    "orders": os.path.join(OUT_DIR, "orders.jsonl"),
    "payments": os.path.join(OUT_DIR, "payments.jsonl"),
    "refunds": os.path.join(OUT_DIR, "refunds.jsonl"),
}
DEAD_FILE = os.path.join(OUT_DIR, "dead_letter.jsonl")
METRICS_FILE = os.path.join(OUT_DIR, "metrics.json")

# ---------------------------------------------------------------------------
# Datasets. Each entry is one physical line of the input file (no newline).
# ---------------------------------------------------------------------------
DATASET_A = [
    '{"id": "a1", "category": "orders", "amount": 10.50, "currency": "USD"}',
    '{"id": 2, "category": "payments", "amount": 100, "currency": "EUR"}',
    '{"id": "r9", "category": "refunds", "amount": 42.42, "currency": "GBP"}',
    '{not valid json',
    '[1, 2, 3]',
    '{"id": "b2", "category": "orders", "amount": 5.00, "currency": "USD", "extra": "ignored"}',
    '{"category": "orders", "amount": 5.0, "currency": "USD"}',
    '{"id": "c3", "amount": 5.0, "currency": "USD"}',
    '{"id": "d4", "category": "orders", "currency": "USD"}',
    '{"id": "e5", "category": "orders", "amount": 5.0}',
    '{"id": ["x"], "category": "orders", "amount": 5.0, "currency": "USD"}',
    '{"id": "f6", "category": 7, "amount": 5.0, "currency": "USD"}',
    '{"id": "g7", "category": "orders", "amount": "5.0", "currency": "USD"}',
    '{"id": "h8", "category": "orders", "amount": true, "currency": "USD"}',
    '{"id": "i9", "category": "shipping", "amount": 5.0, "currency": "USD"}',
    '{"id": "j10", "category": "orders", "amount": 0, "currency": "USD"}',
    '{"id": "k11", "category": "payments", "amount": -3.5, "currency": "USD"}',
    '{"id": "l12", "category": "orders", "amount": 5.0, "currency": "JPY"}',
    '',
    '{"id": "m13", "category": "payments", "amount": 20.00, "currency": "USD"}',
]

EXPECTED_A_CATEGORIES = {
    "orders": [
        {"id": "a1", "category": "orders", "amount_cents": 1050, "currency": "USD"},
        {"id": "b2", "category": "orders", "amount_cents": 500, "currency": "USD"},
    ],
    "payments": [
        {"id": "2", "category": "payments", "amount_cents": 10000, "currency": "EUR"},
        {"id": "m13", "category": "payments", "amount_cents": 2000, "currency": "USD"},
    ],
    "refunds": [
        {"id": "r9", "category": "refunds", "amount_cents": 4242, "currency": "GBP"},
    ],
}
# (line_number -> error string)
EXPECTED_A_DEAD = {
    4: "malformed_json",
    5: "malformed_json",
    7: "missing_field:id",
    8: "missing_field:category",
    9: "missing_field:amount",
    10: "missing_field:currency",
    11: "invalid_type:id",
    12: "invalid_type:category",
    13: "invalid_type:amount",
    14: "invalid_type:amount",
    15: "unknown_category:shipping",
    16: "invalid_amount:non_positive",
    17: "invalid_amount:non_positive",
    18: "invalid_currency:JPY",
    19: "malformed_json",
}
EXPECTED_A_METRICS = {
    "total": 20,
    "valid": 5,
    "dead_letter": 15,
    "by_category": {"orders": 2, "payments": 2, "refunds": 1},
    "by_error": {
        "malformed_json": 3,
        "missing_field:id": 1,
        "missing_field:category": 1,
        "missing_field:amount": 1,
        "missing_field:currency": 1,
        "invalid_type:id": 1,
        "invalid_type:category": 1,
        "invalid_type:amount": 2,
        "unknown_category:shipping": 1,
        "invalid_amount:non_positive": 2,
        "invalid_currency:JPY": 1,
    },
}

DATASET_B = [
    '{"id": "p1", "category": "payments", "amount": 12.34, "currency": "USD"}',
    '{"id": 55, "category": "orders", "amount": 7, "currency": "GBP"}',
    '{"id": "z", "category": "refunds", "amount": 0.99, "currency": "EUR"}',
    'garbage line here',
    '{"id": "x", "category": "refunds", "amount": 3.0}',
    '{"id": "y", "category": "grocery", "amount": 3.0, "currency": "USD"}',
    '{"id": "w", "category": "payments", "amount": -1, "currency": "USD"}',
    '{"id": "v", "category": "payments", "amount": 9.5, "currency": "CAD"}',
    '{"id": null, "category": "orders", "amount": 3.0, "currency": "USD"}',
    '{"id": "u", "category": "refunds", "amount": 2.50, "currency": "EUR"}',
]

EXPECTED_B_CATEGORIES = {
    "orders": [
        {"id": "55", "category": "orders", "amount_cents": 700, "currency": "GBP"},
    ],
    "payments": [
        {"id": "p1", "category": "payments", "amount_cents": 1234, "currency": "USD"},
    ],
    "refunds": [
        {"id": "z", "category": "refunds", "amount_cents": 99, "currency": "EUR"},
        {"id": "u", "category": "refunds", "amount_cents": 250, "currency": "EUR"},
    ],
}
EXPECTED_B_DEAD = {
    4: "malformed_json",
    5: "missing_field:currency",
    6: "unknown_category:grocery",
    7: "invalid_amount:non_positive",
    8: "invalid_currency:CAD",
    9: "invalid_type:id",
}
EXPECTED_B_METRICS = {
    "total": 10,
    "valid": 4,
    "dead_letter": 6,
    "by_category": {"orders": 1, "payments": 1, "refunds": 2},
    "by_error": {
        "malformed_json": 1,
        "missing_field:currency": 1,
        "unknown_category:grocery": 1,
        "invalid_amount:non_positive": 1,
        "invalid_currency:CAD": 1,
        "invalid_type:id": 1,
    },
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _canonical(objs):
    """Return a sorted list of canonical JSON strings for order-independent compare."""
    return sorted(json.dumps(o, sort_keys=True) for o in objs)


def _read_jsonl(path):
    objs = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if line == "":
                continue
            objs.append(json.loads(line))
    return objs


def run_pipeline(dataset_lines):
    """Write dataset, clean outputs, run the pipeline, return parsed outputs.

    Returns a dict with keys: 'categories' (dict cat->list of objs),
    'dead' (list of objs), 'metrics' (obj).
    """
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(INPUT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(dataset_lines) + "\n")

    if os.path.isdir(OUT_DIR):
        shutil.rmtree(OUT_DIR)

    result = subprocess.run(
        [sys.executable, "-m", "bytewax.run", "pipeline:flow"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        "Pipeline run 'python -m bytewax.run pipeline:flow' failed with exit "
        f"code {result.returncode}.\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )

    for name, path in CATEGORY_FILES.items():
        assert os.path.isfile(path), f"Expected category output file {path} to exist after the run."
    assert os.path.isfile(DEAD_FILE), f"Expected dead-letter file {DEAD_FILE} to exist after the run."
    assert os.path.isfile(METRICS_FILE), f"Expected metrics file {METRICS_FILE} to exist after the run."

    categories = {name: _read_jsonl(path) for name, path in CATEGORY_FILES.items()}
    dead = _read_jsonl(DEAD_FILE)
    metrics = _read_jsonl(METRICS_FILE)
    assert len(metrics) == 1, f"metrics.json must contain exactly one JSON object, found {len(metrics)}."
    return {"categories": categories, "dead": dead, "metrics": metrics[0]}


def _expected_dead_objs(dataset_lines, line_to_error):
    out = []
    for line_no, err in line_to_error.items():
        out.append({"raw": dataset_lines[line_no - 1], "error": err, "line": line_no})
    return out


def _check_dataset(dataset_lines, expected_categories, expected_dead_map, expected_metrics):
    out = run_pipeline(dataset_lines)

    # Category routing + normalization (order-independent).
    for cat, expected in expected_categories.items():
        got = out["categories"][cat]
        for obj in got:
            assert set(obj.keys()) == {"id", "category", "amount_cents", "currency"}, (
                f"Normalized {cat} record has unexpected keys: {sorted(obj.keys())}"
            )
        assert _canonical(got) == _canonical(expected), (
            f"Mismatch in {cat}.jsonl.\nExpected: {_canonical(expected)}\nGot: {_canonical(got)}"
        )

    # Dead-letter records: exact keys, raw text, error reason and line number.
    for obj in out["dead"]:
        assert set(obj.keys()) == {"raw", "error", "line"}, (
            f"Dead-letter record has unexpected keys: {sorted(obj.keys())}"
        )
    expected_dead = _expected_dead_objs(dataset_lines, expected_dead_map)
    assert _canonical(out["dead"]) == _canonical(expected_dead), (
        f"Mismatch in dead_letter.jsonl.\nExpected: {_canonical(expected_dead)}\nGot: {_canonical(out['dead'])}"
    )

    # Metrics summary: exact object.
    assert out["metrics"] == expected_metrics, (
        f"Mismatch in metrics.json.\nExpected: {expected_metrics}\nGot: {out['metrics']}"
    )
    # Cross-invariant: total == valid + dead_letter.
    m = out["metrics"]
    assert m["total"] == m["valid"] + m["dead_letter"], (
        f"metrics 'total' must equal 'valid' + 'dead_letter': {m}"
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
def test_dataset_a_full_pipeline():
    """Happy path + all edge/error cases on the primary 20-line dataset."""
    _check_dataset(DATASET_A, EXPECTED_A_CATEGORIES, EXPECTED_A_DEAD, EXPECTED_A_METRICS)


def test_dataset_b_rerun_anticheat():
    """Re-run on a different hidden dataset to defeat hardcoded outputs."""
    _check_dataset(DATASET_B, EXPECTED_B_CATEGORIES, EXPECTED_B_DEAD, EXPECTED_B_METRICS)
