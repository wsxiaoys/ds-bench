import importlib
import os

import pytest

PROJECT_DIR = "/home/user/myproject"
RESUME_PATH = os.path.join(PROJECT_DIR, "resume.pdf")


def test_llama_cloud_sdk_importable():
    try:
        importlib.import_module("llama_cloud")
    except ImportError as exc:
        pytest.fail(f"Expected the v2 LlamaCloud Python SDK (`llama-cloud`) to be importable: {exc}")


def test_llama_cloud_client_class_exposed():
    module = importlib.import_module("llama_cloud")
    assert hasattr(module, "LlamaCloud"), "The `llama_cloud` package must expose the `LlamaCloud` client class."


def test_pydantic_importable():
    try:
        importlib.import_module("pydantic")
    except ImportError as exc:
        pytest.fail(f"Expected pydantic to be available for defining the Extract schema: {exc}")


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} must exist before the task starts."


def test_resume_pdf_present():
    assert os.path.isfile(RESUME_PATH), f"Resume PDF {RESUME_PATH} must exist before the task starts."
    assert os.path.getsize(RESUME_PATH) > 0, f"Resume PDF {RESUME_PATH} must be non-empty."


def test_resume_pdf_signature():
    with open(RESUME_PATH, "rb") as fp:
        header = fp.read(5)
    assert header.startswith(b"%PDF-"), "resume.pdf must be a valid PDF file (missing %PDF- header)."


def test_llama_cloud_api_key_env_present():
    assert os.environ.get("LLAMA_CLOUD_API_KEY"), "LLAMA_CLOUD_API_KEY environment variable must be set."


def test_run_id_env_present():
    run_id = os.environ.get("ZEALT_RUN_ID", "")
    assert run_id.startswith("zr-") and len(run_id) > 3, (
        "ZEALT_RUN_ID environment variable must be set to a `zr-<suffix>` value before the task starts."
    )
