import importlib.util
import os

PROJECT_DIR = "/home/user/project"
ASSETS_DIR = os.path.join(PROJECT_DIR, "assets")
REPORT_PDF = os.path.join(ASSETS_DIR, "report.pdf")


def test_docling_importable():
    assert importlib.util.find_spec("docling") is not None, (
        "The 'docling' package is not importable in the environment."
    )


def test_docling_core_importable():
    assert importlib.util.find_spec("docling_core") is not None, (
        "The 'docling_core' package is not importable in the environment."
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_assets_dir_exists():
    assert os.path.isdir(ASSETS_DIR), (
        f"Assets directory {ASSETS_DIR} does not exist."
    )


def test_report_pdf_exists():
    assert os.path.isfile(REPORT_PDF), (
        f"Input PDF {REPORT_PDF} does not exist."
    )


def test_report_pdf_is_pdf():
    assert os.path.getsize(REPORT_PDF) > 0, f"Input PDF {REPORT_PDF} is empty."
    with open(REPORT_PDF, "rb") as f:
        header = f.read(5)
    assert header == b"%PDF-", (
        f"Input file {REPORT_PDF} does not have a valid PDF header."
    )


def test_artifacts_path_env_set():
    artifacts_path = os.environ.get("DOCLING_ARTIFACTS_PATH")
    assert artifacts_path, (
        "DOCLING_ARTIFACTS_PATH environment variable is not set; offline models "
        "may be unavailable."
    )
    assert os.path.isdir(artifacts_path), (
        f"DOCLING_ARTIFACTS_PATH points to a missing directory: {artifacts_path}."
    )


def test_solution_not_present_yet():
    assert not os.path.exists(os.path.join(PROJECT_DIR, "main.py")), (
        "main.py should not exist before the task is solved."
    )
    assert not os.path.isdir(os.path.join(PROJECT_DIR, "output")), (
        "The output/ directory should not exist before the task is solved."
    )
