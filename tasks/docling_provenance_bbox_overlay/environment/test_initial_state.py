import importlib
import os

PROJECT_DIR = "/home/user/docling_overlay"
INPUT_PDF = os.path.join(PROJECT_DIR, "assets", "report.pdf")
MODELS_DIR = "/opt/app-root/src/.cache/docling/models"


def test_docling_importable():
    try:
        importlib.import_module("docling.document_converter")
    except Exception as exc:  # noqa: BLE001
        raise AssertionError(f"Failed to import docling.document_converter: {exc}")


def test_docling_core_importable():
    try:
        importlib.import_module("docling_core.types.doc")
    except Exception as exc:  # noqa: BLE001
        raise AssertionError(f"Failed to import docling_core.types.doc: {exc}")


def test_pillow_importable():
    try:
        importlib.import_module("PIL.Image")
    except Exception as exc:  # noqa: BLE001
        raise AssertionError(f"Failed to import PIL (Pillow): {exc}")


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_input_pdf_exists():
    assert os.path.isfile(INPUT_PDF), f"Input PDF {INPUT_PDF} does not exist."


def test_input_pdf_is_pdf():
    with open(INPUT_PDF, "rb") as fh:
        header = fh.read(5)
    assert header == b"%PDF-", f"Input file {INPUT_PDF} does not look like a PDF (header={header!r})."


def test_input_pdf_non_trivial_size():
    size = os.path.getsize(INPUT_PDF)
    assert size > 1000, f"Input PDF {INPUT_PDF} is unexpectedly small ({size} bytes)."


def test_prebaked_models_present():
    assert os.path.isdir(MODELS_DIR), (
        f"Pre-baked Docling model directory {MODELS_DIR} is missing; offline conversion would fail."
    )


def test_artifacts_path_env_set():
    value = os.environ.get("DOCLING_ARTIFACTS_PATH", "")
    assert value, "DOCLING_ARTIFACTS_PATH environment variable is not set."
