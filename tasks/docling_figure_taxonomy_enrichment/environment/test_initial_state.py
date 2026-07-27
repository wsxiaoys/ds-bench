import os
import importlib.util

import pytest

PROJECT_DIR = "/home/user/project"
PDF_PATH = os.path.join(PROJECT_DIR, "assets", "report.pdf")


def test_docling_importable():
    assert importlib.util.find_spec("docling") is not None, (
        "The 'docling' library is not importable in the environment."
    )


def test_docling_core_importable():
    assert importlib.util.find_spec("docling_core") is not None, (
        "The 'docling_core' library is not importable in the environment."
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_input_pdf_exists():
    assert os.path.isfile(PDF_PATH), (
        f"Input PDF fixture {PDF_PATH} does not exist."
    )


def test_input_pdf_is_pdf():
    with open(PDF_PATH, "rb") as f:
        header = f.read(5)
    assert header == b"%PDF-", (
        f"Input fixture {PDF_PATH} does not look like a valid PDF (missing %PDF- header)."
    )


def test_artifacts_path_env_configured():
    artifacts_path = os.environ.get("DOCLING_ARTIFACTS_PATH")
    assert artifacts_path and os.path.isdir(artifacts_path), (
        "DOCLING_ARTIFACTS_PATH is not set to an existing directory; "
        "offline model cache is required."
    )
