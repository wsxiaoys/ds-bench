import importlib
import os

import pytest

PROJECT_DIR = "/home/user/myproject"
INPUT_PDF = os.path.join(PROJECT_DIR, "input", "sample.pdf")


def test_llama_cloud_sdk_importable():
    """The new v2 LlamaCloud Python SDK must be installed and importable."""
    try:
        module = importlib.import_module("llama_cloud")
    except Exception as exc:  # pragma: no cover - diagnostic
        pytest.fail(f"Failed to import llama_cloud SDK: {exc}")
    assert hasattr(module, "LlamaCloud"), (
        "llama_cloud.LlamaCloud class is missing — wrong/legacy SDK installed?"
    )


def test_legacy_llama_cloud_services_not_installed():
    """The legacy `llama-cloud-services` wrapper pins `llama-cloud<0.2` and must not be co-installed."""
    try:
        importlib.import_module("llama_cloud_services")
    except ImportError:
        return
    pytest.fail(
        "Legacy `llama_cloud_services` package is installed. The new v2 SDK "
        "(`llama-cloud>=2`) must be used in isolation."
    )


def test_api_key_env_var_present():
    """LlamaCloud SDK reads LLAMA_CLOUD_API_KEY from the environment."""
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY", "")
    assert api_key, "LLAMA_CLOUD_API_KEY environment variable is not set."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_input_pdf_exists():
    assert os.path.isfile(INPUT_PDF), f"Input PDF {INPUT_PDF} does not exist."
    assert os.path.getsize(INPUT_PDF) > 0, f"Input PDF {INPUT_PDF} is empty."
