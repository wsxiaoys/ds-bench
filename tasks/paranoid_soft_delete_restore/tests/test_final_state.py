import os
import subprocess
import json
import pytest

PROJECT_DIR = "/home/user/project"

@pytest.fixture(scope="module", autouse=True)
def setup_environment():
    """Setup: remove existing database to ensure a clean state."""
    db_path = os.path.join(PROJECT_DIR, "database.sqlite")
    if os.path.isfile(db_path):
        os.remove(db_path)
    yield

def run_cli_command(*args):
    result = subprocess.run(
        ["node", "run.js", *args],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR
    )
    return result

def test_01_create_user_alice():
    result = run_cli_command("create", "alice")
    assert result.returncode == 0, f"'node run.js create alice' failed: {result.stderr}"
    assert "Created user alice with ID 1" in result.stdout, f"Expected 'Created user alice with ID 1', got: {result.stdout}"

def test_02_create_user_bob():
    result = run_cli_command("create", "bob")
    assert result.returncode == 0, f"'node run.js create bob' failed: {result.stderr}"
    assert "Created user bob with ID 2" in result.stdout, f"Expected 'Created user bob with ID 2', got: {result.stdout}"

def test_03_delete_user_1():
    result = run_cli_command("delete", "1")
    assert result.returncode == 0, f"'node run.js delete 1' failed: {result.stderr}"
    assert "Soft deleted user 1" in result.stdout, f"Expected 'Soft deleted user 1', got: {result.stdout}"

def test_04_list_active_users():
    result = run_cli_command("list")
    assert result.returncode == 0, f"'node run.js list' failed: {result.stderr}"
    try:
        users = json.loads(result.stdout)
    except json.JSONDecodeError:
        pytest.fail(f"Failed to parse JSON from 'node run.js list' output: {result.stdout}")
    
    assert isinstance(users, list), "Output should be a JSON array"
    assert len(users) == 1, f"Expected exactly 1 active user, got {len(users)}"
    assert users[0]["username"] == "bob", "Expected active user to be 'bob'"
    assert users[0]["id"] == 2, "Expected active user ID to be 2"

def test_05_list_all_users():
    result = run_cli_command("list-all")
    assert result.returncode == 0, f"'node run.js list-all' failed: {result.stderr}"
    try:
        users = json.loads(result.stdout)
    except json.JSONDecodeError:
        pytest.fail(f"Failed to parse JSON from 'node run.js list-all' output: {result.stdout}")
    
    assert isinstance(users, list), "Output should be a JSON array"
    assert len(users) == 2, f"Expected exactly 2 users, got {len(users)}"
    
    alice = next((u for u in users if u["id"] == 1), None)
    bob = next((u for u in users if u["id"] == 2), None)
    
    assert alice is not None, "User 'alice' (ID 1) not found in list-all output"
    assert bob is not None, "User 'bob' (ID 2) not found in list-all output"
    
    assert alice["deletedAt"] is not None, "Expected 'deletedAt' for alice to be non-null"
    assert bob["deletedAt"] is None, "Expected 'deletedAt' for bob to be null"

def test_06_restore_user_1():
    result = run_cli_command("restore", "1")
    assert result.returncode == 0, f"'node run.js restore 1' failed: {result.stderr}"
    assert "Restored user 1" in result.stdout, f"Expected 'Restored user 1', got: {result.stdout}"

def test_07_list_active_users_after_restore():
    result = run_cli_command("list")
    assert result.returncode == 0, f"'node run.js list' failed: {result.stderr}"
    try:
        users = json.loads(result.stdout)
    except json.JSONDecodeError:
        pytest.fail(f"Failed to parse JSON from 'node run.js list' output: {result.stdout}")
    
    assert isinstance(users, list), "Output should be a JSON array"
    assert len(users) == 2, f"Expected exactly 2 active users after restore, got {len(users)}"
    
    ids = [u["id"] for u in users]
    assert 1 in ids, "Expected user ID 1 to be in active list after restore"
    assert 2 in ids, "Expected user ID 2 to be in active list after restore"
