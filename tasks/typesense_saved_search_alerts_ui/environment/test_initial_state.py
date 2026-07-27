import json
import os
import shutil

import pytest

PROJECT_DIR = "/home/user/saved-search-alerts"
DATA_DIR = os.path.join(PROJECT_DIR, "data")
BASELINE_PATH = os.path.join(DATA_DIR, "baseline.json")
CATALOG_PATH = os.path.join(DATA_DIR, "catalog.json")
TYPESENSE_BIN = "/usr/local/bin/typesense-server"


def test_typesense_server_binary_available():
    assert os.path.isfile(TYPESENSE_BIN) and os.access(TYPESENSE_BIN, os.X_OK), (
        f"Typesense server binary not found or not executable at {TYPESENSE_BIN}."
    )


def test_node_runtime_available():
    assert shutil.which("node") is not None, "node runtime not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm not found in PATH."


def test_typesense_api_key_env_present():
    assert os.path.isfile("/etc/typesense-api-key"), "API key file /etc/typesense-api-key is missing."
    with open("/etc/typesense-api-key", "r") as f:
        assert f.read().strip(), "API key file is empty."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_data_directory_exists():
    assert os.path.isdir(DATA_DIR), f"Data directory {DATA_DIR} does not exist."


def _load_json_array(path):
    assert os.path.isfile(path), f"Expected seed file {path} does not exist."
    with open(path) as f:
        data = json.load(f)
    assert isinstance(data, list), f"Seed file {path} must contain a JSON array."
    return data


def test_baseline_seed_file():
    docs = _load_json_array(BASELINE_PATH)
    assert len(docs) == 6, f"Expected 6 baseline documents in {BASELINE_PATH}, got {len(docs)}."
    names = {d.get("name") for d in docs}
    expected = {
        "Aurora Wireless Headphones",
        "Nimbus Bluetooth Speaker",
        "Zenith Cookbook",
        "Orbit Sci-Fi Novel",
        "Comet Building Blocks",
        "Pixel Board Game",
    }
    assert expected.issubset(names), (
        f"Baseline seed file is missing expected product names. Missing: {expected - names}"
    )
    for d in docs:
        for key in ("id", "name", "category", "price"):
            assert key in d, f"Baseline document {d} is missing key '{key}'."


def test_catalog_seed_file():
    docs = _load_json_array(CATALOG_PATH)
    assert len(docs) == 5, f"Expected 5 catalog documents in {CATALOG_PATH}, got {len(docs)}."
    names = {d.get("name") for d in docs}
    expected = {
        "Solaris Wireless Earbuds",
        "Galaxy USB Charger",
        "Wireless Garden Doorbell",
        "Meteor Mystery Novel",
        "Helix Programming Book",
    }
    assert expected.issubset(names), (
        f"Catalog seed file is missing expected product names. Missing: {expected - names}"
    )
    for d in docs:
        for key in ("id", "name", "category", "price"):
            assert key in d, f"Catalog document {d} is missing key '{key}'."
