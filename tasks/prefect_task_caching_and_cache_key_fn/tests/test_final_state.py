import os
import subprocess
import pytest

PROJECT_DIR = "/home/user/project"
FLOW_SCRIPT = os.path.join(PROJECT_DIR, "flow.py")

def test_flow_script_exists():
    """Priority 3 fallback: basic file existence check."""
    assert os.path.isfile(FLOW_SCRIPT), f"flow.py not found at {FLOW_SCRIPT}"

def test_flow_script_execution():
    """Priority 1: Run the script to verify functionality and caching behavior."""
    result = subprocess.run(
        ["python3", "flow.py"],
        capture_output=True, text=True, cwd=PROJECT_DIR
    )
    assert result.returncode == 0, f"'python3 flow.py' failed: {result.stderr}"
    # Prefect logs usually show 'Cached' when a task is cached
    assert "Cached" in result.stdout or "Cached" in result.stderr or "cached" in result.stdout.lower() or "cached" in result.stderr.lower(), \
        f"Expected to find cache hit logs in output, got: {result.stdout} {result.stderr}"

def test_cache_key_fn_usage():
    """Priority 3 fallback: Source code inspection to ensure correct usage of cache_key_fn."""
    with open(FLOW_SCRIPT) as f:
        content = f.read()
    assert "cache_key_fn" in content, "Expected 'cache_key_fn' to be used in the task definition."
