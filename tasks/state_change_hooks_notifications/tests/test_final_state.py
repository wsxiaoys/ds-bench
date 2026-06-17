import os
import subprocess
import pytest

PROJECT_DIR = "/home/user/project"
FLOW_SCRIPT = os.path.join(PROJECT_DIR, "flow.py")
SUCCESS_LOG = os.path.join(PROJECT_DIR, "success.log")
FAILURE_LOG = os.path.join(PROJECT_DIR, "failure.log")

def test_flow_script_exists():
    assert os.path.isfile(FLOW_SCRIPT), f"Flow script {FLOW_SCRIPT} does not exist."

def test_flow_execution_succeeds():
    result = subprocess.run(
        ["python3", "flow.py"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, f"Flow script execution failed with exit code {result.returncode}. Error: {result.stderr}"

def test_success_log_exists_and_contains_expected_text():
    assert os.path.isfile(SUCCESS_LOG), f"Success log {SUCCESS_LOG} does not exist."
    with open(SUCCESS_LOG, "r") as f:
        content = f.read()
    assert "Workflow succeeded" in content, f"Expected 'Workflow succeeded' in success.log, got: {content}"

def test_failure_log_exists_and_contains_expected_text():
    assert os.path.isfile(FAILURE_LOG), f"Failure log {FAILURE_LOG} does not exist."
    with open(FAILURE_LOG, "r") as f:
        content = f.read()
    assert "Workflow failed" in content, f"Expected 'Workflow failed' in failure.log, got: {content}"
