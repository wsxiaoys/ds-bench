import os
import json
import pytest
from e2b import Sandbox

WORK_DIR = "/home/user"
SANDBOX_ID_FILE = os.path.join(WORK_DIR, "sandbox_id.txt")
METADATA_FILE = os.path.join(WORK_DIR, "retrieved_metadata.json")

@pytest.fixture(scope="session", autouse=True)
def cleanup_sandbox():
    yield
    # Teardown: kill the sandbox if it exists
    if os.path.isfile(SANDBOX_ID_FILE):
        try:
            with open(SANDBOX_ID_FILE, "r") as f:
                sandbox_id = f.read().strip()
            if sandbox_id:
                Sandbox.kill(sandbox_id)
        except Exception:
            pass

def test_script_exists():
    assert os.path.isfile(os.path.join(WORK_DIR, "manage_sandbox.py")), "manage_sandbox.py script not found"

def test_sandbox_id_file_exists():
    assert os.path.isfile(SANDBOX_ID_FILE), f"Sandbox ID file not found: {SANDBOX_ID_FILE}"
    with open(SANDBOX_ID_FILE, "r") as f:
        content = f.read().strip()
    assert len(content) > 0, "sandbox_id.txt is empty"

def test_metadata_file_exists():
    assert os.path.isfile(METADATA_FILE), f"Metadata file not found: {METADATA_FILE}"
    with open(METADATA_FILE, "r") as f:
        try:
            metadata = json.load(f)
        except json.JSONDecodeError:
            pytest.fail("retrieved_metadata.json is not a valid JSON file")
            
    assert metadata.get("user_id") == "devops_user_99", "Metadata user_id mismatch"
    assert metadata.get("environment") == "staging", "Metadata environment mismatch"
    assert metadata.get("purpose") == "infrastructure_testing", "Metadata purpose mismatch"

def test_sandbox_metadata_via_api():
    # Verify that the sandbox is actually running and has the correct metadata
    with open(SANDBOX_ID_FILE, "r") as f:
        sandbox_id = f.read().strip()
        
    paginator = Sandbox.list()
    running_sandboxes = paginator.next_items()
    
    target_sandbox = None
    for s in running_sandboxes:
        if s.sandbox_id == sandbox_id:
            target_sandbox = s
            break
            
    assert target_sandbox is not None, f"Sandbox {sandbox_id} is not currently running"
    
    metadata = target_sandbox.metadata or {}
    assert metadata.get("user_id") == "devops_user_99", "Actual API Metadata user_id mismatch"
    assert metadata.get("environment") == "staging", "Actual API Metadata environment mismatch"
    assert metadata.get("purpose") == "infrastructure_testing", "Actual API Metadata purpose mismatch"
