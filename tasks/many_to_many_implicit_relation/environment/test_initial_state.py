import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"
SCHEMA_PATH = os.path.join(PROJECT_DIR, "prisma", "schema.prisma")


def test_node_available():
    assert shutil.which("node") is not None, "node must be in PATH"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project dir must exist at {PROJECT_DIR}"


def test_schema_has_user_and_post():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "model User" in content, "schema.prisma must have User model"
    assert "model Post" in content, "schema.prisma must have Post model"


def test_schema_has_no_tag_model():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "model Tag" not in content, "schema.prisma must NOT have Tag model yet"


def test_db_has_post_table():
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.post.count().then(n => { console.log(n); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"post.count() must succeed; stderr={result.stderr.strip()}"


def test_m2m_script_does_not_exist():
    assert not os.path.isfile(os.path.join(PROJECT_DIR, "m2m.js")), "m2m.js must not exist yet"
