import os
import subprocess
import json
import pytest

PROJECT_DIR = "/home/user/project"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")

def test_output_log_exists():
    """Priority 3 fallback: Verify that the log file exists and contains execution logs."""
    assert os.path.isfile(LOG_FILE), f"Output log file {LOG_FILE} does not exist."
    with open(LOG_FILE, "r") as f:
        content = f.read()
    assert len(content.strip()) > 0, f"Output log file {LOG_FILE} is empty."

def test_markdown_artifact_created_via_cli():
    """Priority 1: Use Prefect CLI to verify the artifact exists."""
    result = subprocess.run(
        ["prefect", "artifact", "inspect", "my-markdown-artifact", "--output", "json"],
        capture_output=True, text=True, cwd=PROJECT_DIR
    )
    assert result.returncode == 0, \
        f"'prefect artifact inspect' failed. The artifact might not have been created. Error: {result.stderr}"
    
    try:
        artifacts = json.loads(result.stdout)
    except json.JSONDecodeError:
        pytest.fail(f"Failed to parse JSON from 'prefect artifact inspect'. Output: {result.stdout}")
    
    assert isinstance(artifacts, list) and len(artifacts) > 0, \
        f"Expected at least one artifact with key 'my-markdown-artifact', got: {artifacts}"
    
    artifact = artifacts[0]
    assert artifact.get("key") == "my-markdown-artifact", \
        f"Expected artifact key 'my-markdown-artifact', got: {artifact.get('key')}"
    assert artifact.get("type") == "markdown", \
        f"Expected artifact type 'markdown', got: {artifact.get('type')}"
