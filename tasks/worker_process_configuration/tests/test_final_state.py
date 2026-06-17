import os
import subprocess
import pytest

PROJECT_DIR = "/home/user/myproject"
LOG_FILE = "/home/user/myproject/worker.log"
PREFECT_YAML = "/home/user/myproject/prefect.yaml"

def test_prefect_yaml_exists():
    """Priority 3 fallback: basic file existence check."""
    assert os.path.isfile(PREFECT_YAML), f"prefect.yaml not found at {PREFECT_YAML}"
    with open(PREFECT_YAML, "r") as f:
        content = f.read()
    assert "pipeline-deployment" in content, "Expected 'pipeline-deployment' in prefect.yaml"

def test_work_pool_exists_via_cli():
    """Priority 1: Use Prefect CLI to verify the work pool exists."""
    result = subprocess.run(
        ["prefect", "work-pool", "inspect", "local-work-pool"],
        capture_output=True, text=True, cwd=PROJECT_DIR
    )
    assert result.returncode == 0, f"'prefect work-pool inspect' failed: {result.stderr}"
    assert "local-work-pool" in result.stdout, f"Expected 'local-work-pool' in work pool inspection, got: {result.stdout}"

def test_deployment_exists_via_cli():
    """Priority 1: Use Prefect CLI to verify the deployment exists."""
    result = subprocess.run(
        ["prefect", "deployment", "inspect", "my-flow/pipeline-deployment"],
        capture_output=True, text=True, cwd=PROJECT_DIR
    )
    assert result.returncode == 0, f"'prefect deployment inspect' failed: {result.stderr}"
    assert "pipeline-deployment" in result.stdout, f"Expected 'pipeline-deployment' in deployment inspection, got: {result.stdout}"

def test_worker_log_exists():
    """Priority 3 fallback: basic file existence check."""
    assert os.path.isfile(LOG_FILE), f"worker.log not found at {LOG_FILE}"
    with open(LOG_FILE, "r") as f:
        content = f.read()
    assert len(content) > 0, "Expected worker.log to not be empty"
