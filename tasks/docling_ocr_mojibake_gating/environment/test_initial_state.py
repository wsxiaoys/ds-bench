import os
import shutil

import pytest

PROJECT_DIR = "/home/user/project"
ASSET_PDF = os.path.join(PROJECT_DIR, "assets", "source.pdf")


def test_docling_importable():
    try:
        import docling  # noqa: F401
        from docling.document_converter import DocumentConverter  # noqa: F401
    except Exception as exc:  # pragma: no cover - defensive
        pytest.fail(f"Failed to import docling / DocumentConverter: {exc}")


def test_tesseract_available():
    assert shutil.which("tesseract") is not None, (
        "tesseract binary not found in PATH; the offline OCR engine is required."
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_source_pdf_present():
    assert os.path.isfile(ASSET_PDF), (
        f"Input fixture PDF {ASSET_PDF} does not exist; it must be baked into the image."
    )
    assert os.path.getsize(ASSET_PDF) > 0, f"Input fixture PDF {ASSET_PDF} is empty."


def test_source_pdf_is_valid_pdf():
    with open(ASSET_PDF, "rb") as f:
        header = f.read(5)
    assert header == b"%PDF-", (
        f"Input fixture {ASSET_PDF} does not look like a PDF (missing %PDF- header)."
    )
