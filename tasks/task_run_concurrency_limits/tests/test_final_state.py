import os
import subprocess
import json
import pytest

PROJECT_DIR = "/home/user/project"

def test_concurrency_limit_set_via_cli():
    """Priority 1: Use Prefect CLI to verify the concurrency limit."""
    # Ensure server is reachable. It should have been started by Docker CMD.
    # The output of `prefect concurrency-limit inspect heavy-processing`
    result = subprocess.run(
        ["prefect", "concurrency-limit", "inspect", "heavy-processing"],
        capture_output=True, text=True, cwd="/home/user/project"
    )
    assert result.returncode == 0, \
        f"'prefect concurrency-limit inspect' failed: {result.stderr}"

    # Check if limit is 2. The output might be text or JSON depending on the CLI version.
    # We can check if '2' is in the output and 'heavy-processing' is in the output.
    assert "2" in result.stdout and "heavy-processing" in result.stdout, \
        f"Expected concurrency limit 2 for 'heavy-processing', got: {result.stdout}"

def test_flow_py_updated_with_tag():
    """Priority 3 fallback: basic file check to see if the tag was added."""
    flow_path = os.path.join(PROJECT_DIR, "flow.py")
    assert os.path.isfile(flow_path), f"File {flow_path} missing."

    with open(flow_path) as f:
        content = f.read()

    assert "tags=[\"heavy-processing\"]" in content or "tags=['heavy-processing']" in content, \
        "Expected process_data task to have tags=['heavy-processing'] in flow.py."
