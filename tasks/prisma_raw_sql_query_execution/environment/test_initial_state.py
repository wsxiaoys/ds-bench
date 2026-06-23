import os
import shutil
import subprocess
import json

PROJECT_DIR = "/home/user/myproject"
SCHEMA_PATH = os.path.join(PROJECT_DIR, "prisma", "schema.prisma")


def test_node_available():
    assert shutil.which("node") is not None, "node must be in PATH"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project dir must exist at {PROJECT_DIR}"


def test_schema_has_user_model():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "model User" in content, "schema.prisma must have User model"


def test_db_has_three_users():
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.user.count().then(n => { console.log(n); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"stderr={result.stderr.strip()}"
    assert result.stdout.strip() == "3", (
        f"DB must have exactly 3 users; found {result.stdout.strip()}"
    )


def test_user_names_are_mixed_case():
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.user.findMany().then(u => { console.log(JSON.stringify(u.map(x=>x.name))); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"stderr={result.stderr.strip()}"
    names = json.loads(result.stdout.strip())
    assert "Alice" in names and "Bob" in names and "Carol" in names, (
        f"DB must have users Alice, Bob, Carol; found {names}"
    )


def test_rawsql_script_does_not_exist():
    assert not os.path.isfile(os.path.join(PROJECT_DIR, "rawsql.js")), \
        "rawsql.js must not exist yet"
