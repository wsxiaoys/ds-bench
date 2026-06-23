import subprocess
import os
import pytest
import time

WORK_DIR = "/home/user"
SANDBOX_ID_FILE = "/home/user/sandbox_id.txt"
E2B_API_KEY_FILE = "/home/user/e2b_api_key.txt"

@pytest.fixture(scope="session")
def sandbox_id():
    try:
        with open(SANDBOX_ID_FILE, "r") as f:
            sandbox_id = f.read().strip()
    except FileNotFoundError:
        pytest.fail(f"Sandbox ID file not found: {SANDBOX_ID_FILE}")

    if not sandbox_id:
        pytest.fail(f"Sandbox ID file is empty: {SANDBOX_ID_FILE}")
    return sandbox_id

@pytest.fixture(scope="session")
def e2b_api_key():
    try:
        with open(E2B_API_KEY_FILE, "r") as f:
            api_key = f.read().strip()
    except FileNotFoundError:
        pytest.fail(f"E2B API key file not found: {E2B_API_KEY_FILE}")

    if not api_key:
        pytest.fail(f"E2B API key file is empty: {E2B_API_KEY_FILE}")

    return api_key

@pytest.fixture
def e2b_env(e2b_api_key):
    """
    Create an env dict for subprocess calls with E2B_API_KEY injected.
    Does not mutate global os.environ.
    """
    env = os.environ.copy()
    env["E2B_API_KEY"] = e2b_api_key
    return env

def test_sandbox_id_file_exists():
    assert os.path.isfile(SANDBOX_ID_FILE), f"Sandbox ID file not found: {SANDBOX_ID_FILE}"

def test_sandbox_hello_file(sandbox_id, e2b_env):
    result = subprocess.run(
        ["e2b", "sandbox", "exec", sandbox_id, "cat", "/home/user/hello.txt"],
        capture_output=True,
        text=True,
        env=e2b_env,
    )
    assert result.returncode == 0, f"Failed to execute command in sandbox. STDERR: {result.stderr}"
    assert "Hello E2B" in result.stdout, f"Expected 'Hello E2B' in output, got: {result.stdout}"
