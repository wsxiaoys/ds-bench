import json
import os
import shutil

TYPESENSE_BINARY = "/usr/local/bin/typesense-server"
PROJECT_DIR = "/home/user/admin-ui"
DATASET_PATH = "/home/user/dataset/products.jsonl"


def test_typesense_server_binary_available():
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


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_seed_dataset_present():
    assert os.path.isfile(DATASET_PATH), (
        f"Seed dataset {DATASET_PATH} does not exist."
    )
    with open(DATASET_PATH, encoding="utf-8") as f:
        lines = [ln for ln in f.read().splitlines() if ln.strip()]
    assert len(lines) == 6, (
        f"Expected 6 dataset rows in {DATASET_PATH}, found {len(lines)}."
    )
    # Every non-empty line must be a valid JSON object.
    for ln in lines:
        json.loads(ln)
