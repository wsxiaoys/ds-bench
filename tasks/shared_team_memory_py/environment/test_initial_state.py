import importlib
import os

import pytest

PROJECT_DIR = "/home/user/myproject"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Expected project directory {PROJECT_DIR} to exist before the task starts."
    )


def test_alchemystai_sdk_importable():
    try:
        importlib.import_module("alchemyst_ai")
    except ImportError as exc:  # pragma: no cover - diagnostic only
        pytest.fail(
            "Expected the Alchemyst AI Python SDK package `alchemyst_ai` to be importable "
            f"(install via `pip install alchemystai`). Import failed: {exc}"
        )


def test_alchemyst_api_key_env_present():
    value = os.environ.get("ALCHEMYST_AI_API_KEY")
    assert value, (
        "Expected the ALCHEMYST_AI_API_KEY environment variable to be set in the task environment."
    )


def test_zealt_run_id_env_present():
    value = os.environ.get("ZEALT_RUN_ID")
    assert value, (
        "Expected the ZEALT_RUN_ID environment variable to be set so the task can scope shared resources."
    )
