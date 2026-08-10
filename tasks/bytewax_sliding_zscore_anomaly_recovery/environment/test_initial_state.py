import json
import os
from datetime import datetime, timezone

import pytest

PROJECT_DIR = "/home/user/project"
DATA_PATH = os.path.join(PROJECT_DIR, "data", "sensor_readings.jsonl")


def test_bytewax_installed_and_correct_version():
    from importlib.metadata import version

    assert version("bytewax") == "0.21.1", (
        "bytewax must be installed at exactly version 0.21.1."
    )


def test_bytewax_importable():
    import bytewax.operators  # noqa: F401
    import bytewax.operators.windowing  # noqa: F401

    assert True


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_input_data_file_exists():
    assert os.path.isfile(DATA_PATH), (
        f"Input data file {DATA_PATH} does not exist."
    )


def _load_rows():
    rows = []
    with open(DATA_PATH) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def test_input_data_is_non_empty():
    rows = _load_rows()
    assert len(rows) > 0, f"Input data file {DATA_PATH} is empty."


def test_input_data_has_expected_schema():
    rows = _load_rows()
    for row in rows:
        assert set(row.keys()) == {"sensor_id", "ts", "value"}, (
            "Each reading must contain exactly the keys 'sensor_id', 'ts', 'value'."
        )
        assert isinstance(row["sensor_id"], str), "'sensor_id' must be a string."
        assert isinstance(row["value"], (int, float)), "'value' must be numeric."
        # ts must be an ISO-8601 UTC timestamp on whole-second boundaries.
        ts = datetime.fromisoformat(row["ts"])
        assert ts.tzinfo is not None, "'ts' must be timezone-aware (UTC)."
        assert ts.utcoffset() == timezone.utc.utcoffset(None), (
            "'ts' must be expressed in UTC."
        )
        assert ts.microsecond == 0, "'ts' must be on a whole-second boundary."


def test_input_data_is_sorted_and_unique():
    rows = _load_rows()
    ts_values = [row["ts"] for row in rows]
    assert ts_values == sorted(ts_values), (
        "Input readings must be sorted ascending by 'ts'."
    )
    pairs = [(row["sensor_id"], row["ts"]) for row in rows]
    assert len(pairs) == len(set(pairs)), (
        "Each (sensor_id, ts) pair in the input must be unique."
    )
