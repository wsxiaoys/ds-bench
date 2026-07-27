import os
import shutil
import subprocess

import pytest

PROJECT_DIR = "/home/user/prefect_seq"


def test_prefect_importable():
    import prefect  # noqa: F401

    assert prefect is not None, "The prefect package could not be imported."


def test_prefect_cli_available():
    assert shutil.which("prefect") is not None, "The 'prefect' CLI was not found in PATH."


def test_prefect_version_is_pinned():
    result = subprocess.run(
        ["prefect", "version"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"'prefect version' failed: {result.stderr}"
    assert "3.4.25" in result.stdout, (
        f"Expected Prefect version 3.4.25 to be installed, got: {result.stdout}"
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Expected project directory {PROJECT_DIR} to exist."
    )
