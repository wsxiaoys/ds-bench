import os
import subprocess
import sqlite3
import pytest

PROJECT_DIR = "/home/user/project"
DB_PATH = os.path.join(PROJECT_DIR, "database.sqlite")

def test_migration_up_and_down():
    # 1. Run migration
    result = subprocess.run(
        ["npx", "sequelize-cli", "db:migrate"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, f"db:migrate failed: {result.stderr}\n{result.stdout}"

    # 2. Check backfilled data
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Users;")
    users = cursor.fetchall()
    
    assert len(users) > 0, "No users found in the database. Expected existing users to be present."
    for user in users:
        assert "departmentId" in user.keys(), "departmentId column is missing after migration."
        assert user["departmentId"] == 1, f"Expected departmentId to be 1, got {user['departmentId']} for user {user['id']}."

    # 3. Check foreign key constraint
    cursor.execute("PRAGMA foreign_key_list(Users);")
    fks = cursor.fetchall()
    
    fk_found = False
    for fk in fks:
        if fk["table"] == "Departments" and fk["from"] == "departmentId" and fk["to"] == "id":
            fk_found = True
            break
            
    assert fk_found, "Foreign key constraint on departmentId referencing Departments(id) not found."

    # 4. Run migration undo
    result_undo = subprocess.run(
        ["npx", "sequelize-cli", "db:migrate:undo"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True
    )
    assert result_undo.returncode == 0, f"db:migrate:undo failed: {result_undo.stderr}\n{result_undo.stdout}"

    # 5. Verify column is removed
    cursor.execute("PRAGMA table_info(Users);")
    columns = cursor.fetchall()
    
    for col in columns:
        assert col["name"] != "departmentId", "departmentId column was not removed after db:migrate:undo."

    conn.close()
