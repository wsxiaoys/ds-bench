import importlib
import os

import pytest

PROJECT_DIR = "/home/user/myproject"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_alchemyst_ai_sdk_importable():
    try:
        importlib.import_module("alchemyst_ai")
    except ImportError as exc:  # pragma: no cover - explicit failure message
        pytest.fail(
            f"The `alchemyst_ai` Python SDK is not importable: {exc}. "
            "It must be pre-installed in the environment."
        )


def test_alchemyst_ai_api_key_env_var_set():
    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    assert api_key, (
        "ALCHEMYST_AI_API_KEY must be set in the environment so the CLI can "
        "authenticate with the Alchemyst AI Context Engine."
    )


def test_zealt_run_id_env_var_set():
    run_id = os.environ.get("ZEALT_RUN_ID")
    assert run_id, (
        "ZEALT_RUN_ID must be set in the environment so file_name values can "
        "be namespaced to avoid 409 Conflict errors."
    )
