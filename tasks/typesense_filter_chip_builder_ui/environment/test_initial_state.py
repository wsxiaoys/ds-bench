import json
import os

TYPESENSE_BINARY = "/usr/local/bin/typesense-server"
PROJECT_DIR = "/home/user/filterchip"
DATASET_PATH = os.path.join(PROJECT_DIR, "data", "products.jsonl")

REQUIRED_FIELDS = {"id", "name", "category", "brand", "price", "rating", "tags"}


def test_typesense_binary_available():
    assert os.path.isfile(TYPESENSE_BINARY), (
        f"Typesense server binary not found at {TYPESENSE_BINARY}."
    )
    assert os.access(TYPESENSE_BINARY, os.X_OK), (
        f"Typesense server binary at {TYPESENSE_BINARY} is not executable."
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_dataset_file_exists():
    assert os.path.isfile(DATASET_PATH), (
        f"Seed dataset file {DATASET_PATH} does not exist."
    )


def test_dataset_has_twelve_valid_products():
    with open(DATASET_PATH, encoding="utf-8") as f:
        lines = [line for line in f.read().splitlines() if line.strip()]
    assert len(lines) == 12, (
        f"Expected exactly 12 product lines in {DATASET_PATH}, found {len(lines)}."
    )
    ids = set()
    for line in lines:
        doc = json.loads(line)
        missing = REQUIRED_FIELDS - set(doc.keys())
        assert not missing, (
            f"Product line is missing required fields {missing}: {line}"
        )
        assert isinstance(doc["tags"], list), (
            f"'tags' must be an array in product: {line}"
        )
        ids.add(str(doc["id"]))
    assert ids == {str(i) for i in range(1, 13)}, (
        f"Expected product ids 1..12, found {sorted(ids)}."
    )


def test_dataset_contains_special_character_brand():
    with open(DATASET_PATH, encoding="utf-8") as f:
        content = f.read()
    assert "Smith, Jones & Co." in content, (
        "Expected a brand value containing special characters "
        "('Smith, Jones & Co.') in the seed dataset."
    )
