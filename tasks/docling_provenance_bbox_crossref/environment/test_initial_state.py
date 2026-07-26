import os
import importlib.util

PROJECT_DIR = "/home/user/project"
PDF_PATH = os.path.join(PROJECT_DIR, "assets", "report.pdf")


def test_docling_importable():
    assert importlib.util.find_spec("docling") is not None, \
        "The 'docling' package is not importable in the environment."


def test_docling_core_importable():
    assert importlib.util.find_spec("docling_core") is not None, \
        "The 'docling_core' package is not importable in the environment."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), \
        f"Project directory {PROJECT_DIR} does not exist."


def test_assets_dir_exists():
    assets_dir = os.path.join(PROJECT_DIR, "assets")
    assert os.path.isdir(assets_dir), \
        f"Assets directory {assets_dir} does not exist."


def test_input_pdf_exists():
    assert os.path.isfile(PDF_PATH), \
        f"Input fixture PDF {PDF_PATH} does not exist."


def test_input_pdf_is_nonempty_pdf():
    assert os.path.getsize(PDF_PATH) > 0, \
        f"Input fixture PDF {PDF_PATH} is empty."
    with open(PDF_PATH, "rb") as f:
        header = f.read(5)
    assert header == b"%PDF-", \
        f"Input fixture {PDF_PATH} does not appear to be a valid PDF (missing %PDF- header)."
