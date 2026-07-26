import os

import pytest

PROJECT_DIR = "/home/user/project"
INPUT_PDF = os.path.join(PROJECT_DIR, "assets", "report.pdf")


def test_docling_importable():
    try:
        import docling  # noqa: F401
        from docling.document_converter import DocumentConverter  # noqa: F401
    except Exception as exc:  # pragma: no cover - failure path
        pytest.fail(f"Failed to import the docling library: {exc}")


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_input_pdf_exists():
    assert os.path.isfile(INPUT_PDF), f"Input fixture {INPUT_PDF} does not exist."
    assert os.path.getsize(INPUT_PDF) > 0, f"Input fixture {INPUT_PDF} is empty."


def test_input_pdf_is_pdf():
    with open(INPUT_PDF, "rb") as fp:
        header = fp.read(5)
    assert header == b"%PDF-", f"Input fixture {INPUT_PDF} is not a valid PDF file."


def test_output_not_yet_created():
    output_dir = os.path.join(PROJECT_DIR, "output")
    assert not os.path.exists(output_dir), (
        f"Output directory {output_dir} should not exist before the task begins."
    )
