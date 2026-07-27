import importlib.metadata
import json
import os

PROJECT_DIR = "/home/user/project"
EVENTS_FILE = os.path.join(PROJECT_DIR, "events.json")


def test_bytewax_importable():
    import bytewax  # noqa: F401


def test_bytewax_version():
    version = importlib.metadata.version("bytewax")
    assert version == "0.21.1", f"Expected bytewax 0.21.1, found {version}."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_events_file_exists():
    assert os.path.isfile(EVENTS_FILE), f"Input file {EVENTS_FILE} does not exist."


def test_events_file_schema():
    with open(EVENTS_FILE) as f:
        data = json.load(f)
    assert isinstance(data, list), "events.json must contain a JSON array."
    assert len(data) > 0, "events.json must contain at least one event."
    for item in data:
        assert isinstance(item, dict), "Each event must be a JSON object."
        assert isinstance(item.get("seq"), int), "Each event must have an integer 'seq'."
        assert isinstance(item.get("key"), str), "Each event must have a string 'key'."
        assert isinstance(item.get("value"), int), "Each event must have an integer 'value'."
