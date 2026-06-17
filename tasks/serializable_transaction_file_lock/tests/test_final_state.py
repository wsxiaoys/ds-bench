import os
import subprocess
import pytest

PROJECT_DIR = "/home/user/prefect-project"
RUN_SCRIPT = os.path.join(PROJECT_DIR, "run_concurrent.py")
COUNTER_FILE = os.path.join(PROJECT_DIR, "counter.txt")

def test_run_concurrent_script_exists():
    assert os.path.isfile(RUN_SCRIPT), f"Script {RUN_SCRIPT} does not exist."

def test_concurrent_execution_succeeds_and_updates_counter():
    # Run the concurrent script
    result = subprocess.run(
        ["python3", RUN_SCRIPT],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR
    )
    assert result.returncode == 0, f"run_concurrent.py failed with error:\n{result.stderr}\nOutput:\n{result.stdout}"

    # Read the counter file
    assert os.path.isfile(COUNTER_FILE), f"Counter file {COUNTER_FILE} does not exist."
    with open(COUNTER_FILE, "r") as f:
        content = f.read().strip()
    
    assert content == "5", f"Expected final counter value to be '5', but got '{content}'."
