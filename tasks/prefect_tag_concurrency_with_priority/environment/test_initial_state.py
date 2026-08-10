import os
import shutil
import subprocess
import urllib.request
import urllib.error

import pytest

API_URL = "http://127.0.0.1:4200/api"
RUN_ID_PATH = "/logs/artifacts/run-id"


def test_prefect_binary_available():
    assert shutil.which("prefect") is not None, "prefect binary not found in PATH."


def test_prefect_importable():
    try:
        import prefect  # noqa: F401
    except Exception as exc:  # pragma: no cover - defensive
        pytest.fail(f"Failed to import the prefect package: {exc}")


def test_prefect_version_is_pinned():
    result = subprocess.run(
        ["prefect", "version"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"`prefect version` failed: {result.stderr}"
    assert "3.4.25" in result.stdout, (
        f"Expected Prefect 3.4.25 to be installed, got:\n{result.stdout}"
    )


def test_local_prefect_server_is_running():
    health_url = f"{API_URL}/health"
    try:
        with urllib.request.urlopen(health_url, timeout=15) as response:
            status = response.status
    except urllib.error.URLError as exc:  # pragma: no cover - defensive
        pytest.fail(f"Local Prefect server API not reachable at {health_url}: {exc}")
    assert status == 200, f"Prefect server health check returned status {status}."


def test_run_id_file_exists():
    assert os.path.isfile(RUN_ID_PATH), (
        f"run-id file {RUN_ID_PATH} does not exist; it is required to scope resource names."
    )
    with open(RUN_ID_PATH) as f:
        run_id = f.read().strip()
    assert run_id, f"run-id file {RUN_ID_PATH} is empty."
