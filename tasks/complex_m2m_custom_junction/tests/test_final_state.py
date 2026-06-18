import subprocess
import json
import os
import pytest

PROJECT_DIR = "/home/user/sequelize-m2m"

def test_add_user_to_project_admin():
    """Verify adding a user to a project as admin."""
    result = subprocess.run(
        ["node", "cli.js", "add", "alice", "project_x", "admin"],
        capture_output=True, text=True, cwd=PROJECT_DIR
    )
    assert result.returncode == 0, f"'node cli.js add' failed: {result.stderr}"
    assert "Success: alice added to project_x as admin" in result.stdout, \
        f"Expected success message for project_x admin, got: {result.stdout}"

def test_add_user_to_project_member():
    """Verify adding a user to a project as member."""
    result = subprocess.run(
        ["node", "cli.js", "add", "alice", "project_y", "member"],
        capture_output=True, text=True, cwd=PROJECT_DIR
    )
    assert result.returncode == 0, f"'node cli.js add' failed: {result.stderr}"
    assert "Success: alice added to project_y as member" in result.stdout, \
        f"Expected success message for project_y member, got: {result.stdout}"

def test_list_projects_for_user():
    """Verify listing projects for a user returns the correct JSON array with roles."""
    result = subprocess.run(
        ["node", "cli.js", "list", "alice"],
        capture_output=True, text=True, cwd=PROJECT_DIR
    )
    assert result.returncode == 0, f"'node cli.js list' failed: {result.stderr}"
    
    try:
        # Find the JSON array in the output in case there's other logging
        output = result.stdout.strip()
        start_idx = output.find('[')
        end_idx = output.rfind(']') + 1
        assert start_idx != -1 and end_idx != 0, "No JSON array found in output"
        
        data = json.loads(output[start_idx:end_idx])
    except json.JSONDecodeError as e:
        pytest.fail(f"Failed to parse JSON from output: {result.stdout}\nError: {e}")
        
    assert isinstance(data, list), f"Expected a JSON array, got {type(data)}"
    
    # We expect exactly these two objects in the array
    expected_x = {"name": "project_x", "role": "admin"}
    expected_y = {"name": "project_y", "role": "member"}
    
    assert expected_x in data, f"Expected {expected_x} in results, got: {data}"
    assert expected_y in data, f"Expected {expected_y} in results, got: {data}"
