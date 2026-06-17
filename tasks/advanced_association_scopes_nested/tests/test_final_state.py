import os
import json
import subprocess
import pytest

PROJECT_DIR = "/home/user/myproject"
OUTPUT_FILE = os.path.join(PROJECT_DIR, "output.json")
QUERY_SCRIPT = os.path.join(PROJECT_DIR, "query.js")

def test_run_npm_install():
    """Run npm install sequelize sqlite3."""
    result = subprocess.run(
        ["npm", "install", "sequelize", "sqlite3"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, f"npm install failed: {result.stderr}"

def test_run_query_script():
    """Run node query.js to execute the user's script."""
    assert os.path.isfile(QUERY_SCRIPT), f"query.js not found at {QUERY_SCRIPT}"
    result = subprocess.run(
        ["node", "query.js"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, f"node query.js failed: {result.stderr}"

def test_output_file_exists():
    """Check that /home/user/myproject/output.json exists."""
    assert os.path.isfile(OUTPUT_FILE), f"output.json not found at {OUTPUT_FILE}"

def test_output_structure():
    """Verify the output structure of output.json."""
    with open(OUTPUT_FILE, "r") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as e:
            pytest.fail(f"Failed to parse output.json: {e}")

    # The root object should have name: 'TechCorp'
    assert data.get("name") == "TechCorp", f"Expected root object name to be 'TechCorp', got {data.get('name')}"
    
    # It should have a divisions array
    assert "divisions" in data, "Expected 'divisions' array in root object"
    assert isinstance(data["divisions"], list), "'divisions' should be a list"
    
    # Each division should have a staff array
    for division in data["divisions"]:
        assert "staff" in division, "Expected 'staff' array in division"
        assert isinstance(division["staff"], list), "'staff' should be a list"
        
        # Each staff member should have an assignments array
        for staff in division["staff"]:
            assert "assignments" in staff, "Expected 'assignments' array in staff"
            assert isinstance(staff["assignments"], list), "'assignments' should be a list"
            
            # The assignments array should only contain projects with status: 'active'
            for assignment in staff["assignments"]:
                assert assignment.get("status") == "active", \
                    f"Expected project status to be 'active', got {assignment.get('status')}"
