import os
import subprocess
import pytest

PROJECT_DIR = "/home/user/myproject"
DB_FILE = os.path.join(PROJECT_DIR, "database.sqlite")

def test_script_execution_and_output():
    """Run the script and verify the output contains the exact expected string."""
    result = subprocess.run(
        ["node", "index.js"],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR
    )
    assert result.returncode == 0, f"Script execution failed with error: {result.stderr}"
    assert 'Result: Alice sent "Hello" to Bob' in result.stdout, \
        f"Expected output 'Result: Alice sent \"Hello\" to Bob' not found in stdout. Got: {result.stdout}"

def test_database_schema():
    """Verify the Mails table schema has the correct foreign keys."""
    assert os.path.isfile(DB_FILE), f"Database file not found at {DB_FILE}"
    
    result = subprocess.run(
        ["sqlite3", DB_FILE, ".schema Mails"],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR
    )
    assert result.returncode == 0, f"sqlite3 command failed: {result.stderr}"
    
    schema = result.stdout.lower()
    # Check that there are two foreign keys referencing the Person table (sender and receiver)
    # Since the exact column names might vary (e.g., senderId, receiverId), we look for references
    assert "sender" in schema or "senderid" in schema, "Schema does not contain a foreign key for 'sender'"
    assert "receiver" in schema or "receiverid" in schema, "Schema does not contain a foreign key for 'receiver'"
    assert "references" in schema, "Schema does not contain foreign key REFERENCES"
