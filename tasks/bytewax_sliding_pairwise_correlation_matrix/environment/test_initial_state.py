import importlib.metadata
import json
import os

import pytest

PROJECT_DIR = "/home/user/project"
INPUT_FILE = os.path.join(PROJECT_DIR, "data", "readings.jsonl")


def test_bytewax_importable():
    import bytewax  # noqa: F401


def test_bytewax_version_is_pinned():
    version = importlib.metadata.version("bytewax")
    assert version == "0.21.1", f"Expected bytewax 0.21.1 but found {version}."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_input_file_exists():
    assert os.path.isfile(INPUT_FILE), f"Input file {INPUT_FILE} does not exist."


def test_input_file_is_valid_jsonl():
    with open(INPUT_FILE) as f:
        lines = [ln for ln in f.read().splitlines() if ln.strip()]
    assert len(lines) > 0, "Input file is empty."
    for ln in lines:
        obj = json.loads(ln)
        assert set(obj.keys()) == {"sensor", "ts", "value"}, (
            f"Each reading must have exactly keys sensor/ts/value, got {sorted(obj.keys())}."
        )
        assert isinstance(obj["sensor"], str), "sensor must be a string."
        assert isinstance(obj["ts"], str) and obj["ts"].endswith("Z"), (
            "ts must be an ISO-8601 UTC string ending in 'Z'."
        )
        assert isinstance(obj["value"], (int, float)) and not isinstance(obj["value"], bool), (
            "value must be a number."
        )


def test_input_file_contains_expected_sensors():
    with open(INPUT_FILE) as f:
        sensors = {json.loads(ln)["sensor"] for ln in f.read().splitlines() if ln.strip()}
    for expected in ("s1", "s2", "s3", "s4"):
        assert expected in sensors, f"Expected sensor {expected} to be present in the input data."
