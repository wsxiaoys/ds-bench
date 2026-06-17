import subprocess
import os
import pytest
import json

TASK_INFO_FILE = "/home/user/e2b_task_info.json"
env = os.environ.copy()

def _read_json_file(path):
    try:
        with open(path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        pytest.fail(f"JSON file not found: {path}")
    except json.JSONDecodeError as e:
        pytest.fail(f"Invalid JSON in {path}: {e}")

@pytest.fixture(scope="session")
def sandbox_id():
    data = _read_json_file(TASK_INFO_FILE)
    sandbox_id = data.get("sandbox_id")
    if not sandbox_id:
        pytest.fail(f"'sandbox_id' missing or empty in {TASK_INFO_FILE}")
    return sandbox_id

def test_task_info_file_exists():
    assert os.path.isfile(TASK_INFO_FILE), f"Task info file not found: {TASK_INFO_FILE}"

def test_venv_directory_exists(sandbox_id):
    result = subprocess.run(
        ["e2b", "sandbox", "exec", sandbox_id, "ls", "-d", "/home/user/venv"],
        capture_output=True,
        text=True,
        env=env,
    )
    assert result.returncode == 0, f"Failed to find /home/user/venv in sandbox.\nSTDERR: {result.stderr}"

def test_pandas_installed_in_venv(sandbox_id):
    result = subprocess.run(
        ["e2b", "sandbox", "exec", sandbox_id, "/home/user/venv/bin/python", "-c", "import pandas"],
        capture_output=True,
        text=True,
        env=env,
    )
    assert result.returncode == 0, f"Failed to import pandas using venv python.\nSTDERR: {result.stderr}"

def test_pandas_version_file(sandbox_id):
    result = subprocess.run(
        ["e2b", "sandbox", "exec", sandbox_id, "cat", "/home/user/pandas_version.txt"],
        capture_output=True,
        text=True,
        env=env,
    )
    assert result.returncode == 0, f"Failed to read /home/user/pandas_version.txt in sandbox.\nSTDERR: {result.stderr}"
    assert len(result.stdout.strip()) > 0, "pandas_version.txt is empty"
    # Basic check for version format (e.g., 2.2.2)
    assert "." in result.stdout, f"Expected a version string in pandas_version.txt, got: {result.stdout}"
