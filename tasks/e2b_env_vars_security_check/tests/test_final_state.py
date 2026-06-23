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

def test_sandbox_env_dump_file(sandbox_id):
    result = subprocess.run(
        ["e2b", "sandbox", "exec", sandbox_id, "cat", "/home/user/env_dump.txt"],
        capture_output=True,
        text=True,
        env=env,
    )

    assert result.returncode == 0, (
        f"Failed to execute command in sandbox (sandbox might not be running). STDERR: {result.stderr}"
    )
    
    expected_content = "TOKEN=super-secret-123\nENDPOINT=https://api.example.com"
    assert expected_content in result.stdout, (
        f"Expected environment variables not found in output. Got: {result.stdout}"
    )
