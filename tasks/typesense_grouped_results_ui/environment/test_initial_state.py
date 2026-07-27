import json
import os
import shutil

import pytest

PROJECT_DIR = "/home/user/app"
DATA_FILE = os.path.join(PROJECT_DIR, "data", "products.jsonl")
TYPESENSE_BIN = "/usr/local/bin/typesense-server"

EXPECTED_BRAND_COUNTS = {
    "Azura": 5,
    "Boreas": 2,
    "Cirrus": 3,
    "Denali": 4,
    "Everest": 6,
}
REQUIRED_KEYS = {"id", "name", "brand", "popularity", "price"}


def test_typesense_server_binary_available():
    assert os.path.isfile(TYPESENSE_BIN), f"Typesense server binary not found at {TYPESENSE_BIN}."
    assert os.access(TYPESENSE_BIN, os.X_OK), f"Typesense server binary at {TYPESENSE_BIN} is not executable."


def test_node_runtime_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_dataset_file_exists():
    assert os.path.isfile(DATA_FILE), f"Seed dataset file {DATA_FILE} does not exist."


def test_dataset_content_is_valid():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        lines = [line for line in f.read().splitlines() if line.strip()]

    assert len(lines) == 20, f"Expected 20 product records in {DATA_FILE}, found {len(lines)}."

    brand_counts = {}
    seen_ids = set()
    for line in lines:
        doc = json.loads(line)
        missing = REQUIRED_KEYS - set(doc.keys())
        assert not missing, f"Product record {doc} is missing required keys: {missing}."
        assert isinstance(doc["popularity"], int), f"popularity must be an integer in {doc}."
        assert "Audio" in doc["name"], f"Product name must contain the searchable word 'Audio': {doc}."
        assert doc["id"] not in seen_ids, f"Duplicate product id detected: {doc['id']}."
        seen_ids.add(doc["id"])
        brand_counts[doc["brand"]] = brand_counts.get(doc["brand"], 0) + 1

    assert brand_counts == EXPECTED_BRAND_COUNTS, (
        f"Brand distribution mismatch. Expected {EXPECTED_BRAND_COUNTS}, found {brand_counts}."
    )
