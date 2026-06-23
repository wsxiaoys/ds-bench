import os
import shutil
import subprocess
import json

PROJECT_DIR = "/home/user/myproject"
SCHEMA_PATH = os.path.join(PROJECT_DIR, "prisma", "schema.prisma")

SEED_USERS = {"Alice", "Aaron", "Bob", "Carol", "Dave"}


def test_node_available():
    assert shutil.which("node") is not None, "node must be in PATH"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project dir must exist at {PROJECT_DIR}"


def test_schema_has_user_model():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "model User" in content, "schema.prisma must have User model"


def test_db_has_seeded_users():
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.user.findMany().then(u => { console.log(JSON.stringify(u)); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"findMany must succeed; stderr={result.stderr.strip()}"
    users = json.loads(result.stdout.strip())
    names = {u["name"] for u in users}
    assert SEED_USERS == names, (
        f"Database must be pre-seeded with {SEED_USERS}; found {names}"
    )


def test_query_script_does_not_exist():
    assert not os.path.isfile(os.path.join(PROJECT_DIR, "query.js")), \
        "query.js must not exist yet"


def test_result_file_does_not_exist():
    assert not os.path.isfile(os.path.join(PROJECT_DIR, "query_result.json")), \
        "query_result.json must not exist yet"
