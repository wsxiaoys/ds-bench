import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/reactive_pipeline"


def test_prefect_cli_available():
    assert shutil.which("prefect") is not None, "prefect CLI not found in PATH."


def test_prefect_importable():
    result = subprocess.run(
        ["python3", "-c", "import prefect; print(prefect.__version__)"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"Failed to import prefect: {result.stderr.strip()}"
    )
    assert result.stdout.strip().startswith("3.7.8"), (
        f"Expected Prefect version 3.7.8, got '{result.stdout.strip()}'."
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_prefect_api_url_points_to_local_server():
    api_url = os.environ.get("PREFECT_API_URL", "")
    assert api_url == "http://127.0.0.1:4200/api", (
        "PREFECT_API_URL must point to the local server at "
        f"'http://127.0.0.1:4200/api', got '{api_url}'."
    )


def test_run_id_artifact_available():
    assert os.path.isfile("/logs/artifacts/run-id"), (
        "Expected the run-id artifact at /logs/artifacts/run-id to be present."
    )
