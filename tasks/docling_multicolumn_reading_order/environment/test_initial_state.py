import importlib.util
import os

PROJECT_DIR = "/home/user/reading_order"


def test_docling_importable():
    assert importlib.util.find_spec("docling") is not None, \
        "The 'docling' library is not importable in the environment."


def test_docling_core_importable():
    assert importlib.util.find_spec("docling_core") is not None, \
        "The 'docling_core' library is not importable in the environment."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), \
        f"Project directory {PROJECT_DIR} does not exist."


def test_input_pdf_exists():
    pdf_path = os.path.join(PROJECT_DIR, "assets", "report.pdf")
    assert os.path.isfile(pdf_path), \
        f"Input document {pdf_path} does not exist."


def test_input_pdf_is_pdf():
    pdf_path = os.path.join(PROJECT_DIR, "assets", "report.pdf")
    with open(pdf_path, "rb") as f:
        header = f.read(5)
    assert header == b"%PDF-", \
        f"Input document {pdf_path} does not look like a PDF file."


def test_docling_artifacts_path_configured():
    artifacts_path = os.environ.get("DOCLING_ARTIFACTS_PATH")
    assert artifacts_path, \
        "DOCLING_ARTIFACTS_PATH environment variable is not set."
    assert os.path.isdir(artifacts_path), \
        f"DOCLING_ARTIFACTS_PATH points to a missing directory: {artifacts_path}"
