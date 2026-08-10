import importlib.metadata
import os

import pytest

PROJECT_DIR = "/home/user/etl_router"
INPUT_FILE = os.path.join(PROJECT_DIR, "data", "input.jsonl")


def test_bytewax_importable():
    import bytewax  # noqa: F401


def test_bytewax_version_is_pinned():
    version = importlib.metadata.version("bytewax")
    assert version == "0.21.1", f"Expected bytewax 0.21.1 but found {version}."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_input_file_seeded():
    assert os.path.isfile(INPUT_FILE), f"Seeded input file {INPUT_FILE} does not exist."


def test_input_file_has_expected_line_count():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        lines = f.read().split("\n")
    # File ends with a trailing newline, so the final split element is empty.
    if lines and lines[-1] == "":
        lines = lines[:-1]
    assert len(lines) == 20, f"Expected the seeded input file to contain 20 lines, found {len(lines)}."
