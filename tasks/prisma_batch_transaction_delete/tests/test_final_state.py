import os
import json
import subprocess

PROJECT_DIR = "/home/user/myproject"
RESULT_FILE = os.path.join(PROJECT_DIR, "batch_result.json")


def test_batch_script_runs():
    """Priority 1: Execute the agent's batch transaction script."""
    result = subprocess.run(
        ["node", "batch.js"], capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"node batch.js must exit 0; stderr={result.stderr.strip()}"


def test_result_file_exists():
    assert os.path.isfile(RESULT_FILE), f"batch_result.json must exist at {RESULT_FILE}"


def test_result_remaining_count():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("remaining") == 6, (
        f"remaining must be 6 (5 kept + 1 new); got: {data.get('remaining')}"
    )


def test_result_new_user_exists():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("newUserExists") is True, (
        f"newUserExists must be true; got: {data.get('newUserExists')}"
    )


def test_old_users_deleted_from_db():
    """Priority 1: Confirm via live DB query."""
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.user.count({ where: { email: { endsWith: '@old.com' } } })"
         ".then(n => { console.log(n); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"stderr={result.stderr.strip()}"
    assert result.stdout.strip() == "0", (
        f"All @old.com users must be deleted; found {result.stdout.strip()} remaining"
    )


def test_new_user_in_db():
    """Priority 1: Confirm new@example.com was created."""
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.user.findUnique({ where: { email: 'new@example.com' } })"
         ".then(u => { console.log(JSON.stringify(u)); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"stderr={result.stderr.strip()}"
    user = json.loads(result.stdout.strip())
    assert user is not None and user.get("email") == "new@example.com", (
        f"new@example.com must exist in DB; got: {user}"
    )
