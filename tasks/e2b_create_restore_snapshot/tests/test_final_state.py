import os
import pytest
from e2b import Sandbox

def test_snapshot_exists_and_restores():
    output_path = "/workspace/output.txt"
    assert os.path.exists(output_path), f"{output_path} not found"
    
    with open(output_path, "r") as f:
        snapshot_id = f.read().strip()
        
    assert len(snapshot_id) > 0, "Snapshot ID is empty"

    try:
        # Create a new sandbox from the snapshot
        sandbox = Sandbox.create(template=snapshot_id)
        
        # Check if the file exists and has correct content
        result = sandbox.commands.run("cat /home/user/checkpoint.txt")
        assert result.exit_code == 0, f"File not found or unreadable: {result.stderr}"
        assert result.stdout.strip() == "checkpoint 1", f"Unexpected content: {result.stdout}"
        
        # Clean up
        sandbox.kill()
    except Exception as e:
        pytest.fail(f"Failed to verify snapshot: {str(e)}")
