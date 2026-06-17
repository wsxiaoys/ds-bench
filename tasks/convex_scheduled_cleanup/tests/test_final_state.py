import os
import subprocess
import json
import time
import pytest

PROJECT_DIR = "/home/user/myproject"

def test_deployment_log_exists():
    """Check that output.log exists and contains the success message."""
    log_path = os.path.join(PROJECT_DIR, "output.log")
    assert os.path.isfile(log_path), f"Log file not found at {log_path}"
    
    with open(log_path, "r") as f:
        content = f.read()
    
    assert "Deployment: success" in content, "Log file does not contain 'Deployment: success'"

def test_cleanup_mutation_behavior():
    """Verify that the deployed cleanup mutation correctly deletes expired sessions."""
    run_id = os.environ.get("ZEALT_RUN_ID", "")
    assert run_id, "ZEALT_RUN_ID environment variable is not set."
    
    table_name = f"sessions_{run_id}"
    data_file = os.path.join(PROJECT_DIR, "data.jsonl")
    
    # Create test data: one expired, one valid
    now = int(time.time() * 1000)
    expired_doc = {"expiresAt": now - 100000, "testId": "expired"}
    valid_doc = {"expiresAt": now + 100000, "testId": "valid"}
    
    with open(data_file, "w") as f:
        f.write(json.dumps(expired_doc) + "\n")
        f.write(json.dumps(valid_doc) + "\n")
        
    # Import data
    import_result = subprocess.run(
        ["npx", "convex", "import", "--prod", "--table", table_name, "data.jsonl"],
        cwd=PROJECT_DIR, capture_output=True, text=True
    )
    assert import_result.returncode == 0, f"'npx convex import' failed: {import_result.stderr}"
    
    # Run the mutation
    run_result = subprocess.run(
        ["npx", "convex", "run", "--prod", "sessions:cleanup"],
        cwd=PROJECT_DIR, capture_output=True, text=True
    )
    assert run_result.returncode == 0, f"'npx convex run' failed: {run_result.stderr}"
    
    # Export data
    export_dir = os.path.join(PROJECT_DIR, "export_dir")
    export_result = subprocess.run(
        ["npx", "convex", "export", "--prod", "--path", export_dir],
        cwd=PROJECT_DIR, capture_output=True, text=True
    )
    assert export_result.returncode == 0, f"'npx convex export' failed: {export_result.stderr}"
    
    # Read exported data
    # Convex export creates a directory with .jsonl files for each table or a zip.
    # The --path flag should create a directory.
    exported_file = os.path.join(export_dir, f"{table_name}.jsonl")
    assert os.path.isfile(exported_file), f"Exported file {exported_file} not found."
    
    with open(exported_file, "r") as f:
        lines = f.readlines()
        
    # Verify that only the valid document remains
    test_ids = []
    for line in lines:
        if not line.strip():
            continue
        doc = json.loads(line)
        if "testId" in doc:
            test_ids.append(doc["testId"])
            
    assert "expired" not in test_ids, "The expired session was not deleted by the cleanup mutation."
    assert "valid" in test_ids, "The valid session was incorrectly deleted by the cleanup mutation."