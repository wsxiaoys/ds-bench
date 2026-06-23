import os
import subprocess
import json
import pytest

PROJECT_DIR = "/home/user/project"

def test_secret_block_exists_and_value():
    """Priority 3 fallback: Use Python to verify the block value."""
    result = subprocess.run(
        ["python3", "-c", "from prefect.blocks.system import Secret; print(Secret.load('my-api-key').get())"],
        capture_output=True, text=True, cwd=PROJECT_DIR
    )
    assert result.returncode == 0, f"Failed to load Secret block: {result.stderr}"
    assert "super-secret-value" in result.stdout, \
        f"Expected 'super-secret-value' in output, got: {result.stdout}"

def test_deployment_exists_and_schedule():
    """Priority 1: Use Prefect CLI to verify the deployment state and cron schedule."""
    result = subprocess.run(
        ["prefect", "deployment", "inspect", "my_flow/my-deployment"],
        capture_output=True, text=True, cwd=PROJECT_DIR
    )
    assert result.returncode == 0, \
        f"'prefect deployment inspect' failed: {result.stderr}"
    
    # The output of prefect deployment inspect is often JSON or YAML-like, but we can check if it has the cron string.
    # The truth says: The command `prefect deployment inspect my_flow/my-deployment` should return a JSON object with a schedule containing `"cron": "0 9 * * *"` or something similar.
    # Let's check for the cron string in the output.
    assert "0 9 * * *" in result.stdout, \
        f"Expected cron schedule '0 9 * * *' in deployment inspect output, got: {result.stdout}"

def test_serve_flow_script_exists():
    """Priority 3 fallback: basic file existence check."""
    script_path = os.path.join(PROJECT_DIR, "serve_flow.py")
    assert os.path.isfile(script_path), \
        f"serve_flow.py not found at {script_path}"
