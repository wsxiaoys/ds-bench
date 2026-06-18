import os
import subprocess
import pytest
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/myproject"

def test_custom_block_file_exists_and_content():
    """Priority 3: Check file existence and basic content."""
    file_path = os.path.join(PROJECT_DIR, "custom_block.py")
    assert os.path.isfile(file_path), f"{file_path} does not exist."

    with open(file_path, 'r') as f:
        content = f.read()

    assert "class DatabaseConfig" in content, "DatabaseConfig class not found in custom_block.py"
    assert "Block" in content, "DatabaseConfig does not appear to inherit from Block"

def test_block_saved_in_prefect():
    """Priority 1: Use prefect CLI to verify the block exists."""
    result = subprocess.run(
        ["prefect", "block", "ls", "--output", "json"],
        capture_output=True, text=True
    )
    assert result.returncode == 0, f"'prefect block ls' failed: {result.stderr}"
    assert "my-db-config" in result.stdout, f"Block 'my-db-config' not found in prefect database. Output: {result.stdout}"

def test_load_block_script_output():
    """Priority 1: Run the user script and check output using amika/pochi-verifier."""
    script_path = os.path.join(PROJECT_DIR, "load_block.py")
    assert os.path.isfile(script_path), f"{script_path} does not exist."

    result = subprocess.run(
        ["python3", "load_block.py"],
        cwd=PROJECT_DIR,
        capture_output=True, text=True
    )
    assert result.returncode == 0, f"'python3 load_block.py' failed: {result.stderr}"

    verifier = PochiVerifier()
    verify_result = verifier.verify(
        reason="The script should load the 'my-db-config' block and print its host to standard output.",
        truth="The output must contain 'localhost'.",
        evidence=result.stdout,
        trajectory_dir="/logs/verifier/pochi/test_load_block_script_output"
    )
    assert verify_result.status == "pass", f"Amika API verification failed: {verify_result.reason}"
