import json
import os

import pytest

PROJECT_DIR = "/home/user/project"
ASSETS_DIR = os.path.join(PROJECT_DIR, "assets")
PDF_PATH = os.path.join(ASSETS_DIR, "report.pdf")
QUERIES_PATH = os.path.join(ASSETS_DIR, "queries.json")

EXPECTED_QUERY_IDS = {
    "q_onboarding",
    "q_billing",
    "q_crypto_heading",
    "q_hardware_table",
    "q_maintenance",
}


def test_docling_importable():
    try:
        import docling  # noqa: F401
        from docling.document_converter import DocumentConverter  # noqa: F401
    except Exception as exc:  # pragma: no cover - defensive
        pytest.fail(f"docling library is not importable in the environment: {exc}")


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_assets_dir_exists():
    assert os.path.isdir(ASSETS_DIR), f"Assets directory {ASSETS_DIR} does not exist."


def test_input_pdf_exists_and_nonempty():
    assert os.path.isfile(PDF_PATH), f"Input PDF {PDF_PATH} does not exist."
    assert os.path.getsize(PDF_PATH) > 0, f"Input PDF {PDF_PATH} is empty."


def test_queries_file_exists():
    assert os.path.isfile(QUERIES_PATH), f"Seeded queries file {QUERIES_PATH} does not exist."


def test_queries_file_schema():
    with open(QUERIES_PATH, encoding="utf-8") as f:
        data = json.load(f)
    assert isinstance(data, list), "queries.json must be a JSON array."
    assert len(data) == 5, f"queries.json must contain exactly 5 entries, found {len(data)}."
    ids = set()
    for entry in data:
        assert isinstance(entry, dict), "Each queries.json entry must be a JSON object."
        assert "query_id" in entry and isinstance(entry["query_id"], str), \
            "Each queries.json entry must have a string 'query_id'."
        assert "query" in entry and isinstance(entry["query"], str) and entry["query"].strip(), \
            "Each queries.json entry must have a non-empty string 'query'."
        ids.add(entry["query_id"])
    assert ids == EXPECTED_QUERY_IDS, \
        f"queries.json query_id set mismatch. Expected {EXPECTED_QUERY_IDS}, found {ids}."
