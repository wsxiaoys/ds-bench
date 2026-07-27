import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/pipeline"
RUN_ID_FILE = "/logs/artifacts/run-id"


def test_prefect_binary_available():
    assert shutil.which("prefect") is not None, "prefect binary not found in PATH."


def test_prefect_importable():
    result = subprocess.run(
        ["python3", "-c", "import prefect"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"Failed to import prefect: {result.stderr.strip()}"
    )


def test_prefect_version_is_pinned():
    result = subprocess.run(
        ["prefect", "version"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"'prefect version' failed: {result.stderr.strip()}"
    )
    assert "3.7.8" in result.stdout, (
        f"Expected Prefect 3.7.8 to be installed, got: {result.stdout.strip()}"
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_run_id_file_exists():
    assert os.path.isfile(RUN_ID_FILE), (
        f"run-id file {RUN_ID_FILE} does not exist."
    )
    with open(RUN_ID_FILE) as f:
        run_id = f.read().strip()
    assert run_id, f"run-id file {RUN_ID_FILE} is empty."
