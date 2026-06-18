import os
import subprocess
import pytest
import json

PROJECT_DIR = "/home/user/project"

def get_suffix():
    run_id = os.environ.get("ZEALT_RUN_ID", "")
    assert run_id, "ZEALT_RUN_ID environment variable is not set."
    return run_id.replace("-", "_")

def test_deploy_log_exists():
    log_file = os.path.join(PROJECT_DIR, "deploy.log")
    assert os.path.isfile(log_file), f"Log file {log_file} does not exist."

def test_valid_data_insertion():
    suffix = get_suffix()
    function_name = f"products_{suffix}:create"
    args = json.dumps({"name": "Valid Product", "price": 100, "inStock": True})
    
    result = subprocess.run(
        ["npx", "convex", "run", "--prod", function_name, args],
        capture_output=True, text=True, cwd=PROJECT_DIR
    )
    assert result.returncode == 0, f"Failed to insert valid data. stderr: {result.stderr}, stdout: {result.stdout}"
    assert result.stdout.strip() != "", "Expected a document ID to be returned, but got empty output."

def test_invalid_data_insertion_fails():
    suffix = get_suffix()
    function_name = f"products_{suffix}:create"
    args = json.dumps({"name": "Invalid Product", "price": "100", "inStock": True})
    
    result = subprocess.run(
        ["npx", "convex", "run", "--prod", function_name, args],
        capture_output=True, text=True, cwd=PROJECT_DIR
    )
    assert result.returncode != 0, "Expected insertion of invalid data to fail, but it succeeded."
    assert "ValidationError" in result.stderr or "validation" in result.stderr.lower() or "error" in result.stderr.lower(), \
        f"Expected a validation error in stderr, got: {result.stderr}"
