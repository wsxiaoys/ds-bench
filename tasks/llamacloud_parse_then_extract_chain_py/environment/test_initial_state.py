import importlib
import os

PROJECT_DIR = "/home/user/myproject"
DATA_FILE = os.path.join(PROJECT_DIR, "data", "invoice.pdf")


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_invoice_pdf_present():
    assert os.path.isfile(DATA_FILE), (
        f"Sample invoice PDF {DATA_FILE} is missing from the initial environment."
    )
    assert os.path.getsize(DATA_FILE) > 0, (
        f"Sample invoice PDF {DATA_FILE} exists but is empty."
    )


def test_llama_cloud_sdk_importable():
    try:
        importlib.import_module("llama_cloud")
    except ImportError as exc:  # pragma: no cover
        raise AssertionError(
            "Python package 'llama_cloud' (LlamaCloud v2 SDK) must be installed and importable."
        ) from exc


def test_pydantic_importable():
    try:
        importlib.import_module("pydantic")
    except ImportError as exc:  # pragma: no cover
        raise AssertionError(
            "Python package 'pydantic' must be installed and importable."
        ) from exc


def test_llama_cloud_api_key_env_set():
    value = os.environ.get("LLAMA_CLOUD_API_KEY")
    assert value, "LLAMA_CLOUD_API_KEY environment variable is not set in the container."


def test_run_id_set():
    value = open("/logs/artifacts/run-id").read().strip()
    assert value, "RUN_ID is not set in the container."
