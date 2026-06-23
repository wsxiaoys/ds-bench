import os
import json
import subprocess

PROJECT_DIR = "/home/user/myproject"
CRUD_SCRIPT = os.path.join(PROJECT_DIR, "crud.js")
RESULT_FILE = os.path.join(PROJECT_DIR, "crud_result.json")


def test_crud_script_exists():
    assert os.path.isfile(CRUD_SCRIPT), f"crud.js must exist at {CRUD_SCRIPT}"


def test_crud_script_runs_successfully():
    """Priority 1: Execute the agent's script and assert exit 0."""
    result = subprocess.run(
        ["node", "crud.js"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, (
        f"node crud.js must exit 0; stderr={result.stderr.strip()}"
    )


def test_result_file_exists():
    assert os.path.isfile(RESULT_FILE), f"crud_result.json must exist at {RESULT_FILE}"


def test_result_file_status_ok():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("status") == "ok", (
        f"crud_result.json must have status='ok'; got: {data}"
    )


def test_result_file_deleted_true():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("deleted") is True, (
        f"crud_result.json must have deleted=true; got: {data}"
    )


def test_user_deleted_from_db():
    """Priority 1: Verify via Prisma client that the test user no longer exists."""
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.user.findUnique({ where: { email: 'test@example.com' } })"
         ".then(u => { console.log(JSON.stringify(u)); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"findUnique must succeed; stderr={result.stderr.strip()}"
    assert result.stdout.strip() == "null", (
        f"User test@example.com must be deleted; got: {result.stdout.strip()}"
    )
