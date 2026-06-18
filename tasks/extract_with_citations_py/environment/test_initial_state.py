import importlib
import os

import pytest

PROJECT_DIR = "/home/user/llamacloud-task"
SAMPLE_INVOICE = os.path.join(PROJECT_DIR, "sample_invoice.txt")


def test_llama_cloud_sdk_importable():
    try:
        importlib.import_module("llama_cloud")
    except Exception as exc:  # pragma: no cover - import error surfaces here
        pytest.fail(
            "The `llama_cloud` Python SDK (v2) must be installed and importable. "
            f"Import failed with: {exc!r}"
        )


def test_llama_cloud_client_class_available():
    module = importlib.import_module("llama_cloud")
    assert hasattr(module, "LlamaCloud"), (
        "Expected `LlamaCloud` class to be exposed by the `llama_cloud` SDK."
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist; it must be created as "
        "part of the initial state."
    )


def test_sample_invoice_file_exists():
    assert os.path.isfile(SAMPLE_INVOICE), (
        f"Expected pre-existing invoice file at {SAMPLE_INVOICE}."
    )


def test_sample_invoice_contains_expected_fields():
    with open(SAMPLE_INVOICE, "r", encoding="utf-8") as f:
        content = f.read()
    # The fixture invoice MUST mention the values the extractor is expected to
    # surface so that downstream verification has a stable ground truth.
    for needle in ("Acme Robotics, Inc.", "INV-2024-9876", "1499.99"):
        assert needle in content, (
            f"Initial invoice fixture at {SAMPLE_INVOICE} is missing required "
            f"reference text: {needle!r}"
        )


def test_llama_cloud_api_key_env_var_present():
    assert os.environ.get("LLAMA_CLOUD_API_KEY"), (
        "LLAMA_CLOUD_API_KEY must be set in the task environment so that the "
        "executor can authenticate with the LlamaCloud Extract API."
    )


def test_zealt_run_id_env_var_present():
    run_id = os.environ.get("ZEALT_RUN_ID", "")
    assert run_id, "ZEALT_RUN_ID must be set in the task environment."
    # Format from the skill rules: zr-[a-z0-9]+
    assert run_id.startswith("zr-") and len(run_id) > 3, (
        f"ZEALT_RUN_ID must look like `zr-<id>`; got {run_id!r}."
    )
