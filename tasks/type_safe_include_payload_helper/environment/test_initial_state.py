import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"
SCHEMA_PATH = os.path.join(PROJECT_DIR, "prisma", "schema.prisma")


def test_node_available():
    assert shutil.which("node") is not None, "node must be in PATH"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project dir must exist at {PROJECT_DIR}"


def test_schema_has_user_with_posts():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "model User" in content, "schema.prisma must have User model"
    assert "posts Post[]" in content, "User must have posts Post[] relation"
    assert "model Post" in content, "schema.prisma must have Post model"


def test_db_queryable():
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.user.count().then(n => { console.log(n); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"DB must be queryable; stderr={result.stderr.strip()}"


def test_payload_helper_does_not_exist():
    assert not os.path.isfile(os.path.join(PROJECT_DIR, "payload_helper.js")), \
        "payload_helper.js must not exist yet"
