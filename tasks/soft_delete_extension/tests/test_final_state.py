import os
import json
import subprocess

PROJECT_DIR = "/home/user/myproject"
RESULT_FILE = os.path.join(PROJECT_DIR, "softdelete_result.json")


def test_softdelete_script_runs():
    """Priority 1: Execute the agent's script."""
    result = subprocess.run(
        ["node", "softdelete.js"], capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"node softdelete.js must exit 0; stderr={result.stderr.strip()}"


def test_result_file_exists():
    assert os.path.isfile(RESULT_FILE), f"softdelete_result.json must exist at {RESULT_FILE}"


def test_visible_count_is_zero():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("visibleCount") == 0, (
        f"visibleCount must be 0 (soft-deleted user excluded by extended findMany); "
        f"got: {data.get('visibleCount')}"
    )


def test_soft_deleted_exists():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("softDeletedExists") is True, (
        "softDeletedExists must be true — user must still exist in DB with deletedAt set"
    )


def test_user_has_deleted_at_set():
    """Priority 1: Confirm via raw Prisma query that deletedAt is non-null."""
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.user.findFirst({ where: { email: 'soft@example.com' } })"
         ".then(u => { console.log(JSON.stringify(u)); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"stderr={result.stderr.strip()}"
    user = json.loads(result.stdout.strip())
    assert user is not None, "User soft@example.com must still exist in DB"
    assert user.get("deletedAt") is not None, (
        f"deletedAt must be set on soft-deleted user; got: {user.get('deletedAt')}"
    )
