import json
import os
import shutil

import pytest

PROJECT_DIR = "/home/user/catalog-search"
DATASET_PATH = os.path.join(PROJECT_DIR, "data", "catalog.json")
TYPESENSE_BIN = "/usr/local/bin/typesense-server"

EXPECTED_RECORDS = {
    "w1": {"name_en": "Sourdough Baking Workshop"},
    "w2": {"name_en": "Ceramic Glazing Class"},
    "w3": {"name_fr": "Nous finissons vos sauces"},
    "w4": {"name_de": "Grundlagen des Schnitzens"},
    "w5": {"name_en": "Vintage Café Signage"},
    "w6": {"name_en": "Naive Folk Painting"},
}


def test_typesense_server_binary_available():
    assert os.path.isfile(TYPESENSE_BIN), (
        f"Typesense server binary not found at {TYPESENSE_BIN}."
    )
    assert os.access(TYPESENSE_BIN, os.X_OK), (
        f"Typesense server binary at {TYPESENSE_BIN} is not executable."
    )


def test_node_runtime_available():
    assert shutil.which("node") is not None, "node runtime not found in PATH."
    assert shutil.which("npm") is not None, "npm not found in PATH."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_dataset_file_exists():
    assert os.path.isfile(DATASET_PATH), (
        f"Seeded dataset {DATASET_PATH} does not exist."
    )


def test_dataset_is_valid_json_array():
    with open(DATASET_PATH, encoding="utf-8") as f:
        data = json.load(f)
    assert isinstance(data, list), "catalog.json must contain a JSON array."
    assert len(data) == len(EXPECTED_RECORDS), (
        f"Expected {len(EXPECTED_RECORDS)} records in catalog.json, found {len(data)}."
    )


def test_dataset_records_have_required_keys():
    with open(DATASET_PATH, encoding="utf-8") as f:
        data = json.load(f)
    for record in data:
        for key in ("id", "name_en", "name_fr", "name_de"):
            assert key in record, (
                f"Record {record!r} is missing required key '{key}'."
            )
            assert isinstance(record[key], str), (
                f"Record {record.get('id')!r} key '{key}' must be a string."
            )


def test_dataset_contains_expected_records():
    with open(DATASET_PATH, encoding="utf-8") as f:
        data = json.load(f)
    by_id = {record["id"]: record for record in data}
    for rid, fields in EXPECTED_RECORDS.items():
        assert rid in by_id, f"Expected record id '{rid}' missing from catalog.json."
        for key, value in fields.items():
            assert by_id[rid][key] == value, (
                f"Record '{rid}' key '{key}' expected {value!r}, "
                f"got {by_id[rid].get(key)!r}."
            )
