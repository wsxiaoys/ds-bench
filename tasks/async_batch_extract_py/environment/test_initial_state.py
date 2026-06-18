import importlib
import os

PROJECT_DIR = "/home/user/myproject"
DATA_DIR = os.path.join(PROJECT_DIR, "data")
EXPECTED_INVOICES = ("invoice_a.pdf", "invoice_b.pdf", "invoice_c.pdf")


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_data_dir_exists():
    assert os.path.isdir(DATA_DIR), (
        f"Data directory {DATA_DIR} does not exist."
    )


def test_invoice_pdfs_present():
    for name in EXPECTED_INVOICES:
        path = os.path.join(DATA_DIR, name)
        assert os.path.isfile(path), (
            f"Sample invoice PDF {path} is missing from the initial environment."
        )
        assert os.path.getsize(path) > 0, (
            f"Sample invoice PDF {path} exists but is empty."
        )


def test_llama_cloud_sdk_importable():
    try:
        importlib.import_module("llama_cloud")
    except ImportError as exc:  # pragma: no cover
        raise AssertionError(
            "Python package 'llama_cloud' (LlamaCloud v2 SDK) must be installed and importable."
        ) from exc


def test_async_llama_cloud_class_available():
    module = importlib.import_module("llama_cloud")
    assert hasattr(module, "AsyncLlamaCloud"), (
        "Expected 'AsyncLlamaCloud' to be exported by the llama_cloud package "
        "(required for async batch extraction)."
    )


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


def test_zealt_run_id_env_set():
    value = os.environ.get("ZEALT_RUN_ID")
    assert value, "ZEALT_RUN_ID environment variable is not set in the container."
