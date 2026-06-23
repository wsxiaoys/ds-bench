import importlib
import os
import sys

import pytest

PROJECT_DIR = "/home/user/extract_task"
DATA_DIR = os.path.join(PROJECT_DIR, "data")
INVOICE_PDF = os.path.join(DATA_DIR, "invoice.pdf")


def test_python_available():
    assert sys.version_info >= (3, 9), (
        f"Python 3.9+ is required for llama-cloud; got {sys.version_info}."
    )


def test_llama_cloud_sdk_importable():
    try:
        module = importlib.import_module("llama_cloud")
    except ImportError as exc:  # pragma: no cover - defensive
        pytest.fail(f"llama_cloud SDK is not importable: {exc}")
    assert hasattr(module, "LlamaCloud"), (
        "llama_cloud.LlamaCloud class is not exposed by the installed SDK."
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_invoice_pdf_present():
    assert os.path.isfile(INVOICE_PDF), (
        f"Sample invoice PDF {INVOICE_PDF} is missing from the environment."
    )
    assert os.path.getsize(INVOICE_PDF) > 0, (
        f"Sample invoice PDF {INVOICE_PDF} is empty."
    )


def test_llama_cloud_api_key_env():
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY", "")
    assert api_key, "LLAMA_CLOUD_API_KEY environment variable is not set."


def test_zealt_run_id_env():
    run_id = os.environ.get("ZEALT_RUN_ID", "")
    assert run_id, "ZEALT_RUN_ID environment variable is not set."
