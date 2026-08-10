import os
import shutil
import subprocess

import pytest

PROJECT_DIR = "/home/user/prefect-throttle"


def test_prefect_binary_available():
    assert shutil.which("prefect") is not None, "prefect binary not found in PATH."


def test_prefect_importable():
    result = subprocess.run(
        ["python3", "-c", "import prefect; print(prefect.__version__)"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"Failed to import prefect: {result.stderr.strip()}"
    )


def test_prefect_version_is_pinned():
    result = subprocess.run(
        ["python3", "-c", "import prefect; print(prefect.__version__)"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"Failed to import prefect: {result.stderr.strip()}"
    )
    assert result.stdout.strip() == "3.4.25", (
        f"Expected prefect version 3.4.25 but found {result.stdout.strip()!r}."
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )
