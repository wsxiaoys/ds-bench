import importlib.util
import os

PROJECT_DIR = "/home/user/project"


def test_docling_importable():
    assert importlib.util.find_spec("docling") is not None, \
        "The 'docling' package is not importable in the environment."


def test_docling_core_importable():
    assert importlib.util.find_spec("docling_core") is not None, \
        "The 'docling_core' package is not importable in the environment."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), \
        f"Project directory {PROJECT_DIR} does not exist."


def test_input_pdf_exists():
    pdf_path = os.path.join(PROJECT_DIR, "assets", "report.pdf")
    assert os.path.isfile(pdf_path), \
        f"Input fixture PDF {pdf_path} does not exist."


def test_input_pdf_nonempty():
    pdf_path = os.path.join(PROJECT_DIR, "assets", "report.pdf")
    assert os.path.getsize(pdf_path) > 0, \
        f"Input fixture PDF {pdf_path} is empty."


def test_model_cache_present():
    # Models must be pre-baked so the pipeline can run fully offline.
    models_dir = "/opt/app-root/src/.cache/docling/models"
    assert os.path.isdir(models_dir), \
        f"Pre-baked Docling model cache {models_dir} is missing; offline run would fail."
