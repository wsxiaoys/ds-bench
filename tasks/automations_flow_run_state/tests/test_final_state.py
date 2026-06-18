import os
import subprocess
import pytest

PROJECT_DIR = "/home/user/myproject"
SUCCESS_LOG = os.path.join(PROJECT_DIR, "success.log")
FAILURE_LOG = os.path.join(PROJECT_DIR, "failure.log")

@pytest.fixture(scope="module", autouse=True)
def run_flow_script():
    """Run the flow_hooks.py script to trigger the hooks."""
    script_path = os.path.join(PROJECT_DIR, "flow_hooks.py")
    assert os.path.isfile(script_path), f"Script {script_path} does not exist."
    
    # Run the script. We don't assert returncode == 0 because failing_flow might raise an exception
    # that isn't caught, which is acceptable as long as the hooks write to the files.
    subprocess.run(
        ["python3", "flow_hooks.py"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True
    )

def test_success_log_exists_and_content():
    assert os.path.isfile(SUCCESS_LOG), f"Success log file {SUCCESS_LOG} was not created."
    with open(SUCCESS_LOG, "r") as f:
        content = f.read().strip()
    assert content == "Success!", f"Expected 'Success!' in {SUCCESS_LOG}, got: '{content}'"

def test_failure_log_exists_and_content():
    assert os.path.isfile(FAILURE_LOG), f"Failure log file {FAILURE_LOG} was not created."
    with open(FAILURE_LOG, "r") as f:
        content = f.read().strip()
    assert content == "Failed!", f"Expected 'Failed!' in {FAILURE_LOG}, got: '{content}'"
