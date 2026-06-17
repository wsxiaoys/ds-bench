import os
import subprocess
import pytest

PROJECT_DIR = "/home/user/project"
MAIN_FILE = os.path.join(PROJECT_DIR, "main.py")
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")

def test_script_execution():
    """Execute the script and ensure it runs successfully."""
    result = subprocess.run(
        ["python3", MAIN_FILE],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR
    )
    assert result.returncode == 0, f"Script execution failed: {result.stderr}"

def test_log_file_exists():
    """Verify that the log file is created."""
    assert os.path.isfile(LOG_FILE), f"Log file not found at {LOG_FILE}"

def test_log_file_content():
    """Verify that the log file contains the correct output."""
    with open(LOG_FILE, "r") as f:
        content = f.read().strip()
    
    expected_output = "['APPLE', 'BANANA', 'CHERRY']"
    assert expected_output in content, f"Expected {expected_output} in log file, got: {content}"

def test_flow_decorators_in_source():
    """Verify that there are at least two @flow decorators in the source code."""
    with open(MAIN_FILE, "r") as f:
        content = f.read()
    
    flow_count = content.count("@flow")
    assert flow_count >= 2, f"Expected at least two @flow decorators, found {flow_count}"
