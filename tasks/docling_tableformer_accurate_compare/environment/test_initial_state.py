import importlib
import json
import os

import pytest

PROJECT_DIR = "/home/user/tfbench"
CORPUS_DIR = os.path.join(PROJECT_DIR, "corpus")
GT_DIR = os.path.join(CORPUS_DIR, "ground_truth")
BUILDER_PATH = "/opt/corpus_builder/build_corpus.py"
ARTIFACTS_PATH = "/opt/app-root/src/.cache/docling/models"

DOC_IDS = ["borderless", "footer_numeric", "grid_basic", "merged_header"]


def test_docling_importable():
    try:
        importlib.import_module("docling")
    except Exception as exc:  # pragma: no cover - defensive
        pytest.fail(f"The 'docling' package could not be imported: {exc}")


def test_docling_core_importable():
    try:
        importlib.import_module("docling_core")
    except Exception as exc:  # pragma: no cover - defensive
        pytest.fail(f"The 'docling_core' package could not be imported: {exc}")


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_corpus_directory_exists():
    assert os.path.isdir(CORPUS_DIR), f"Corpus directory {CORPUS_DIR} does not exist."
    assert os.path.isdir(GT_DIR), f"Ground truth directory {GT_DIR} does not exist."


def test_corpus_pdfs_exist():
    for doc_id in DOC_IDS:
        pdf_path = os.path.join(CORPUS_DIR, f"{doc_id}.pdf")
        assert os.path.isfile(pdf_path), f"Corpus PDF {pdf_path} does not exist."
        assert os.path.getsize(pdf_path) > 0, f"Corpus PDF {pdf_path} is empty."


def test_corpus_has_exactly_four_pdfs():
    pdfs = sorted(f for f in os.listdir(CORPUS_DIR) if f.endswith(".pdf"))
    assert pdfs == [f"{doc_id}.pdf" for doc_id in DOC_IDS], (
        f"Unexpected corpus PDF listing: {pdfs}"
    )


def test_ground_truth_files_are_valid():
    total_tables = 0
    for doc_id in DOC_IDS:
        gt_path = os.path.join(GT_DIR, f"{doc_id}.json")
        assert os.path.isfile(gt_path), f"Ground truth file {gt_path} does not exist."
        with open(gt_path, encoding="utf-8") as handle:
            data = json.load(handle)
        assert data.get("doc_id") == doc_id, f"{gt_path} has a wrong doc_id: {data.get('doc_id')}"
        assert data.get("pdf") == f"{doc_id}.pdf", f"{gt_path} has a wrong pdf field."
        tables = data.get("tables")
        assert isinstance(tables, list) and tables, f"{gt_path} declares no tables."
        for table in tables:
            for key in ("table_index", "page_no", "num_rows", "num_cols", "cells"):
                assert key in table, f"{gt_path} table is missing the key '{key}'."
            assert table["cells"], f"{gt_path} table {table['table_index']} has no cells."
            for cell in table["cells"]:
                for key in ("row", "col", "row_span", "col_span", "text", "is_header"):
                    assert key in cell, f"{gt_path} cell is missing the key '{key}'."
        total_tables += len(tables)
    assert total_tables == 5, f"Expected 5 ground truth tables in the corpus, found {total_tables}."


def test_fixture_builder_module_available():
    assert os.path.isfile(BUILDER_PATH), f"Fixture builder {BUILDER_PATH} does not exist."


def test_model_artifacts_present():
    assert os.path.isdir(ARTIFACTS_PATH), (
        f"Pre-baked Docling model artifacts directory {ARTIFACTS_PATH} does not exist."
    )
    entries = os.listdir(ARTIFACTS_PATH)
    assert entries, f"Pre-baked Docling model artifacts directory {ARTIFACTS_PATH} is empty."


def test_artifacts_path_env_var_set():
    value = os.environ.get("DOCLING_ARTIFACTS_PATH")
    assert value, "DOCLING_ARTIFACTS_PATH is not set in the environment."
    assert os.path.isdir(value), f"DOCLING_ARTIFACTS_PATH points to a missing directory: {value}"
