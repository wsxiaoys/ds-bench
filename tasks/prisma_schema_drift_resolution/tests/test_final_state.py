import os
import json
import subprocess

PROJECT_DIR = "/home/user/myproject"
SCHEMA_PATH = os.path.join(PROJECT_DIR, "prisma", "schema.prisma")
RESULT_FILE = os.path.join(PROJECT_DIR, "drift_result.json")


def test_schema_has_bio_field():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "bio" in content, "schema.prisma must now contain 'bio' field on User model"


def test_drift_check_script_runs():
    """Priority 1: Execute the agent's verification script."""
    result = subprocess.run(
        ["node", "drift_check.js"], capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"node drift_check.js must exit 0; stderr={result.stderr.strip()}"


def test_result_file_exists():
    assert os.path.isfile(RESULT_FILE), f"drift_result.json must exist at {RESULT_FILE}"


def test_result_bio_field():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("bio") == "Hello world", (
        f"Result must have bio='Hello world'; got: {data.get('bio')}"
    )


def test_prisma_client_can_use_bio():
    """Priority 1: Verify via live Prisma query that bio is accessible."""
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.user.findFirst({ where: { bio: 'Hello world' } })"
         ".then(u => { console.log(JSON.stringify(u)); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"stderr={result.stderr.strip()}"
    user = json.loads(result.stdout.strip())
    assert user is not None, "A user with bio='Hello world' must exist in DB"
    assert user.get("bio") == "Hello world", (
        f"User bio must be 'Hello world'; got: {user.get('bio')}"
    )
