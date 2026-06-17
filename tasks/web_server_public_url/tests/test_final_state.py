import subprocess
import os
import pytest
import json

WORK_DIR = "/home/user"
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
def task_info():
    data = _read_json_file(TASK_INFO_FILE)
    
    sandbox_id = data.get("sandbox_id")
    if not sandbox_id:
        pytest.fail(f"'sandbox_id' missing or empty in {TASK_INFO_FILE}")
        
    url = data.get("url")
    if not url:
        pytest.fail(f"'url' missing or empty in {TASK_INFO_FILE}")

    return {"sandbox_id": sandbox_id, "url": url}

def test_task_info_file_exists():
    assert os.path.isfile(TASK_INFO_FILE), f"Task info file not found: {TASK_INFO_FILE}"

def test_sandbox_index_html_file(task_info):
    sandbox_id = task_info["sandbox_id"]
    result = subprocess.run(
        ["e2b", "sandbox", "exec", sandbox_id, "cat", "/home/user/index.html"],
        capture_output=True,
        text=True,
        env=env,
    )

    assert result.returncode == 0, (
        f"Failed to execute command in sandbox.\nSTDERR: {result.stderr}"
    )
    assert "Hello from E2B Sandbox!" in result.stdout, (
        f"Expected 'Hello from E2B Sandbox!' in output, got: {result.stdout}"
    )

def test_public_url_serves_content(task_info):
    url = task_info["url"]
    result = subprocess.run(
        ["curl", "-s", "-f", url],
        capture_output=True,
        text=True,
        env=env,
    )
    
    assert result.returncode == 0, (
        f"Failed to fetch url {url}.\nSTDERR: {result.stderr}"
    )
    assert "Hello from E2B Sandbox!" in result.stdout, (
        f"Expected 'Hello from E2B Sandbox!' from public URL, got: {result.stdout}"
    )
