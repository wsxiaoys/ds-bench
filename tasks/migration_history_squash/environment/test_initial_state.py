import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"
MIGRATIONS_DIR = os.path.join(PROJECT_DIR, "prisma", "migrations")


def test_node_available():
    assert shutil.which("node") is not None, "node must be in PATH"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project dir must exist at {PROJECT_DIR}"


def test_migrations_dir_has_five_entries():
    dirs = [d for d in os.listdir(MIGRATIONS_DIR)
            if os.path.isdir(os.path.join(MIGRATIONS_DIR, d)) and not d.startswith(".")]
    assert len(dirs) == 5, (
        f"prisma/migrations must have exactly 5 migration directories; found {len(dirs)}: {dirs}"
    )


def test_db_is_functional():
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.user.count().then(n => { console.log(n); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"DB must be functional; stderr={result.stderr.strip()}"


def test_squash_result_does_not_exist():
    assert not os.path.isfile(os.path.join(PROJECT_DIR, "squash_result.txt")), \
        "squash_result.txt must not exist yet"
