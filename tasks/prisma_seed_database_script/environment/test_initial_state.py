import os
import shutil
import subprocess
import json

PROJECT_DIR = "/home/user/myproject"
SCHEMA_PATH = os.path.join(PROJECT_DIR, "prisma", "schema.prisma")
SEED_SCRIPT = os.path.join(PROJECT_DIR, "prisma", "seed.js")
PACKAGE_JSON = os.path.join(PROJECT_DIR, "package.json")


def test_node_available():
    assert shutil.which("node") is not None, "node must be available in PATH"


def test_npx_available():
    assert shutil.which("npx") is not None, "npx must be available in PATH"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory must exist at {PROJECT_DIR}"


def test_schema_prisma_exists():
    assert os.path.isfile(SCHEMA_PATH), f"schema.prisma must exist at {SCHEMA_PATH}"


def test_schema_has_user_model():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "model User" in content, "schema.prisma must contain a User model"


def test_database_is_migrated():
    """The User table must already exist in the SQLite DB."""
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.user.findMany().then(u => { console.log(JSON.stringify(u)); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, (
        f"Querying user table must succeed (migration must be applied); "
        f"stderr={result.stderr.strip()}"
    )
    users = json.loads(result.stdout.strip())
    assert isinstance(users, list), "user.findMany() must return a list"


def test_seed_script_does_not_exist_yet():
    assert not os.path.isfile(SEED_SCRIPT), (
        f"prisma/seed.js must NOT exist yet — the agent is expected to create it"
    )


def test_database_has_no_seeded_users():
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.user.count().then(n => { console.log(n); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"user.count() must succeed; stderr={result.stderr.strip()}"
    count = int(result.stdout.strip())
    assert count == 0, f"Database must have 0 users before seeding; found {count}"
