import importlib.util
import os

PROJECT_DIR = "/home/user/project"
INPUT_PDF = os.path.join(PROJECT_DIR, "assets", "complex_table.pdf")


def test_docling_importable():
    assert importlib.util.find_spec("docling") is not None, (
        "The 'docling' package is not importable in this environment."
    )


def test_docling_core_importable():
    assert importlib.util.find_spec("docling_core") is not None, (
        "The 'docling_core' package is not importable in this environment."
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_input_pdf_exists():
    assert os.path.isfile(INPUT_PDF), (
        f"Input fixture PDF {INPUT_PDF} does not exist."
    )


def test_input_pdf_non_empty():
    assert os.path.getsize(INPUT_PDF) > 0, (
        f"Input fixture PDF {INPUT_PDF} is empty."
    )


def test_input_pdf_is_pdf():
    with open(INPUT_PDF, "rb") as f:
        header = f.read(5)
    assert header == b"%PDF-", (
        f"Input fixture {INPUT_PDF} does not look like a PDF (missing %PDF- header)."
    )
