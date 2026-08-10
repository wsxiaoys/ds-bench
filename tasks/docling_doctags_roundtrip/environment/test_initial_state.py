import importlib
import os

import pytest

PROJECT_DIR = "/home/user/project"
FIXTURE_PDF = os.path.join(PROJECT_DIR, "assets", "report.pdf")


def test_docling_importable():
    try:
        importlib.import_module("docling")
    except Exception as exc:  # noqa: BLE001
        pytest.fail(f"The 'docling' library could not be imported: {exc}")


def test_docling_core_importable():
    try:
        importlib.import_module("docling_core.types.doc")
    except Exception as exc:  # noqa: BLE001
        pytest.fail(f"The 'docling_core.types.doc' module could not be imported: {exc}")


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_fixture_pdf_exists():
    assert os.path.isfile(FIXTURE_PDF), f"Fixture PDF {FIXTURE_PDF} does not exist."


def test_fixture_pdf_is_non_empty_pdf():
    assert os.path.getsize(FIXTURE_PDF) > 0, f"Fixture PDF {FIXTURE_PDF} is empty."
    with open(FIXTURE_PDF, "rb") as fh:
        header = fh.read(5)
    assert header == b"%PDF-", (
        f"Fixture {FIXTURE_PDF} does not look like a PDF (missing %PDF- header)."
    )


def test_output_not_pre_created():
    # The pipeline artifacts must be produced by the executor, not pre-seeded.
    out_dir = os.path.join(PROJECT_DIR, "out")
    for name in ("original.doctags", "reconstructed.md", "comparison_report.json"):
        assert not os.path.exists(os.path.join(out_dir, name)), (
            f"Output artifact {name} already exists before the task starts."
        )
