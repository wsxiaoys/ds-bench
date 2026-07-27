import json
import os
import shutil

PROJECT_DIR = "/home/user/typeahead"
DATA_FILE = os.path.join(PROJECT_DIR, "data", "cities.json")
TYPESENSE_BIN = "/usr/local/bin/typesense-server"


def test_typesense_server_binary_available():
    assert os.path.isfile(TYPESENSE_BIN) and os.access(TYPESENSE_BIN, os.X_OK), (
        f"Typesense server binary not found or not executable at {TYPESENSE_BIN}."
    )


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_dataset_file_exists():
    assert os.path.isfile(DATA_FILE), f"Seed dataset file {DATA_FILE} does not exist."


def test_dataset_file_is_valid():
    with open(DATA_FILE) as f:
        records = json.load(f)
    assert isinstance(records, list), "cities.json must contain a JSON array."
    assert len(records) == 15, f"Expected 15 seed records, found {len(records)}."
    required_keys = {"id", "name", "country", "population"}
    for rec in records:
        assert isinstance(rec, dict), "Each record must be a JSON object."
        assert required_keys.issubset(rec.keys()), (
            f"Record {rec!r} is missing one of the required keys {required_keys}."
        )
    by_id = {str(rec["id"]): rec for rec in records}
    assert "5" in by_id, "Expected a record with id '5' (Santiago) in the seed dataset."
    assert by_id["5"]["name"] == "Santiago", "Record id '5' must be Santiago."
    assert by_id["5"]["country"] == "Chile", "Santiago's country must be Chile."
