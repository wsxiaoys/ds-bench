import json
import os
import shutil

PROJECT_DIR = "/home/user/leaderboard"
TYPESENSE_BIN = "/usr/local/bin/typesense-server"
SEED_FILE = os.path.join(PROJECT_DIR, "players.json")

EXPECTED_ROSTER = {
    "p1": ("Alice", 100),
    "p2": ("Bob", 100),
    "p3": ("Carol", 90),
    "p4": ("Dave", 80),
    "p5": ("Eve", 70),
}


def test_typesense_server_binary_installed():
    assert os.path.isfile(TYPESENSE_BIN) and os.access(TYPESENSE_BIN, os.X_OK), (
        f"Typesense server binary is not installed/executable at {TYPESENSE_BIN}."
    )


def test_python_runtime_available():
    assert shutil.which("python3") is not None, "python3 runtime not found in PATH."


def test_node_runtime_available():
    assert shutil.which("node") is not None, "node runtime not found in PATH."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_seed_roster_file_present_and_correct():
    assert os.path.isfile(SEED_FILE), f"Seed roster file {SEED_FILE} does not exist."
    with open(SEED_FILE) as f:
        data = json.load(f)
    assert isinstance(data, list), "players.json must contain a JSON array."
    roster = {}
    for entry in data:
        roster[entry["player_id"]] = (entry["name"], int(entry["score"]))
    assert roster == EXPECTED_ROSTER, (
        f"Seed roster does not match expected initial roster. Got: {roster}"
    )
