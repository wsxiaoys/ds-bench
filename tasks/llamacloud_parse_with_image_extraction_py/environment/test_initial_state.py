import importlib
import os

import pytest

PROJECT_DIR = "/home/user/myproject"
INPUT_PDF = os.path.join(PROJECT_DIR, "input.pdf")


def test_llama_cloud_sdk_importable():
    try:
        module = importlib.import_module("llama_cloud")
    except Exception as exc:  # pragma: no cover - diagnostic message
        pytest.fail(f"`llama_cloud` Python SDK is not installed or importable: {exc}")
    assert hasattr(module, "LlamaCloud"), (
        "`llama_cloud.LlamaCloud` client class is missing; the installed SDK does not match the expected v2 API."
    )


def test_api_key_env_var_set():
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    assert api_key, "LLAMA_CLOUD_API_KEY environment variable is not set."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_input_pdf_exists():
    assert os.path.isfile(INPUT_PDF), f"Input PDF {INPUT_PDF} does not exist."


def test_input_pdf_is_pdf():
    with open(INPUT_PDF, "rb") as f:
        header = f.read(5)
    assert header.startswith(b"%PDF-"), f"Input file {INPUT_PDF} is not a valid PDF (missing %PDF- header)."
