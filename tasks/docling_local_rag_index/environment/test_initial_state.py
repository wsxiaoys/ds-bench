import importlib.util
import os

PROJECT_DIR = "/home/user/project"
CORPUS_DIR = os.path.join(PROJECT_DIR, "corpus")
EXPECTED_PDFS = ["climate.pdf", "robotics.pdf", "finance.pdf"]


def test_docling_importable():
    assert (
        importlib.util.find_spec("docling") is not None
    ), "The 'docling' package must be importable in the environment."


def test_docling_chunking_importable():
    assert (
        importlib.util.find_spec("docling.chunking") is not None
    ), "The 'docling.chunking' module must be importable in the environment."


def test_project_dir_exists():
    assert os.path.isdir(
        PROJECT_DIR
    ), f"Project directory {PROJECT_DIR} must exist before the task starts."


def test_corpus_dir_exists():
    assert os.path.isdir(
        CORPUS_DIR
    ), f"Corpus directory {CORPUS_DIR} must exist before the task starts."


def test_corpus_pdfs_present():
    for name in EXPECTED_PDFS:
        path = os.path.join(CORPUS_DIR, name)
        assert os.path.isfile(path), f"Expected input PDF {path} is missing from the corpus."
        assert os.path.getsize(path) > 0, f"Input PDF {path} must not be empty."


def test_docling_models_prebaked():
    models_path = "/opt/app-root/src/.cache/docling/models"
    assert os.path.isdir(
        models_path
    ), f"Pre-baked Docling model cache {models_path} must exist for offline conversion."
