import json
import os
import shutil

import pytest

PROJECT_DIR = "/home/user/trendsearch"
TYPESENSE_BINARY = "/usr/local/bin/typesense-server"
SEED_FILE = os.path.join(PROJECT_DIR, "catalog-seed.json")


def test_typesense_server_binary_executable():
    assert os.path.isfile(TYPESENSE_BINARY), (
        f"Typesense server binary not found at {TYPESENSE_BINARY}."
    )
    assert os.access(TYPESENSE_BINARY, os.X_OK), (
        f"Typesense server binary at {TYPESENSE_BINARY} is not executable."
    )


def test_node_runtime_available():
    assert shutil.which("node") is not None, (
        "Node.js runtime ('node') not found in PATH."
    )


def test_npm_available():
    assert shutil.which("npm") is not None, (
        "npm not found in PATH; the app is started with 'npm start'."
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_catalog_seed_file_exists():
    assert os.path.isfile(SEED_FILE), (
        f"Catalog seed file {SEED_FILE} does not exist."
    )


def test_catalog_seed_file_is_valid_product_array():
    with open(SEED_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert isinstance(data, list) and len(data) > 0, (
        f"{SEED_FILE} must be a non-empty JSON array of products."
    )
    for key in ("id", "name", "category", "price"):
        assert key in data[0], (
            f"Each product in {SEED_FILE} must contain the key '{key}'."
        )
