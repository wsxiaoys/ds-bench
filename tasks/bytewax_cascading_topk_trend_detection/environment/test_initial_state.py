import importlib.metadata
import json
import os
from datetime import datetime

PROJECT_DIR = "/home/user/project"
INPUT_FILE = os.path.join(PROJECT_DIR, "data", "events.jsonl")


def test_bytewax_importable():
    import bytewax  # noqa: F401


def test_bytewax_version_is_pinned():
    version = importlib.metadata.version("bytewax")
    assert version == "0.21.1", f"Expected bytewax==0.21.1, found {version}."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_input_events_file_exists():
    assert os.path.isfile(INPUT_FILE), f"Input events file {INPUT_FILE} does not exist."


def test_input_events_file_is_valid_jsonl():
    with open(INPUT_FILE) as f:
        lines = [ln for ln in f.read().splitlines() if ln.strip()]
    assert len(lines) > 0, f"Input events file {INPUT_FILE} is empty."
    for i, line in enumerate(lines):
        obj = json.loads(line)
        assert isinstance(obj, dict), f"Line {i} of {INPUT_FILE} is not a JSON object."
        assert "item" in obj and isinstance(obj["item"], str), (
            f"Line {i} of {INPUT_FILE} is missing a string 'item' field."
        )
        assert "ts" in obj and isinstance(obj["ts"], str), (
            f"Line {i} of {INPUT_FILE} is missing a string 'ts' field."
        )
        parsed = datetime.fromisoformat(obj["ts"])
        assert parsed.tzinfo is not None, (
            f"Line {i} of {INPUT_FILE} has a 'ts' without timezone info: {obj['ts']!r}."
        )
