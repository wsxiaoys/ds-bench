import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"
SCHEMA_PATH = os.path.join(PROJECT_DIR, "prisma", "schema.prisma")


def test_node_available():
    assert shutil.which("node") is not None, "node must be in PATH"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project dir must exist at {PROJECT_DIR}"


def test_schema_has_user_but_no_bio():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "model User" in content, "schema.prisma must have User model"
    assert "bio" not in content, (
        "schema.prisma must NOT have 'bio' field yet — it only exists in DB (drift condition)"
    )


def test_db_has_bio_column():
    """The DB must have bio column from raw SQL addition."""
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.$queryRaw`SELECT bio FROM User LIMIT 1`.then(() => { console.log('ok'); p.$disconnect(); })"
         ".catch(e => { console.error(e.message); process.exit(1); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, (
        f"DB must have bio column (added via raw SQL); stderr={result.stderr.strip()}"
    )


def test_drift_check_script_does_not_exist():
    assert not os.path.isfile(os.path.join(PROJECT_DIR, "drift_check.js")), \
        "drift_check.js must not exist yet"
