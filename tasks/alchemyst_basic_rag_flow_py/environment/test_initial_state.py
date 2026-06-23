import os
import importlib

import pytest

PROJECT_DIR = "/home/user/myproject"


def test_alchemyst_sdk_importable():
    """The Alchemyst Python SDK must be installed and importable."""
    mod = importlib.import_module("alchemyst_ai")
    assert mod is not None, "Failed to import the `alchemyst_ai` Python SDK."


def test_project_directory_exists():
    """The project working directory must exist."""
    assert os.path.isdir(PROJECT_DIR), (
        f"Expected project directory {PROJECT_DIR} to exist before the task starts."
    )


def test_alchemyst_api_key_env_present():
    """The ALCHEMYST_AI_API_KEY environment variable must be available to the task."""
    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    assert api_key, (
        "ALCHEMYST_AI_API_KEY must be set in the environment for the task to run."
    )


def test_zealt_run_id_env_present():
    """The ZEALT_RUN_ID environment variable must be available so the task can scope its resources."""
    run_id = os.environ.get("ZEALT_RUN_ID")
    assert run_id, (
        "ZEALT_RUN_ID must be set in the environment so the task can produce a unique file_name."
    )
