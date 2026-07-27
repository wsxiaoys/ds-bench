import importlib.util
import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/state_forcing"
EXPECTED_VERSION = "3.4.25"


def test_prefect_importable():
    assert importlib.util.find_spec("prefect") is not None, (
        "The 'prefect' Python package is not importable in the environment."
    )


def test_prefect_binary_available():
    assert shutil.which("prefect") is not None, (
        "The 'prefect' CLI binary was not found in PATH."
    )


def test_prefect_version_is_pinned():
    result = subprocess.run(
        ["prefect", "version"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"'prefect version' failed with exit code {result.returncode}: {result.stderr}"
    )
    assert EXPECTED_VERSION in result.stdout, (
        f"Expected Prefect version {EXPECTED_VERSION} to be installed, "
        f"but got:\n{result.stdout}"
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Expected project directory {PROJECT_DIR} to exist."
    )
