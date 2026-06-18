import os
import subprocess

PROJECT_DIR = "/home/user/myproject"
MIGRATIONS_DIR = os.path.join(PROJECT_DIR, "prisma", "migrations")
SQUASH_RESULT = os.path.join(PROJECT_DIR, "squash_result.txt")
BASELINE_DIR = os.path.join(MIGRATIONS_DIR, "0001_baseline")
BASELINE_SQL = os.path.join(BASELINE_DIR, "migration.sql")


def test_squash_result_file_exists():
    assert os.path.isfile(SQUASH_RESULT), f"squash_result.txt must exist at {SQUASH_RESULT}"


def test_exactly_one_migration_directory():
    dirs = [d for d in os.listdir(MIGRATIONS_DIR)
            if os.path.isdir(os.path.join(MIGRATIONS_DIR, d)) and not d.startswith(".")]
    assert len(dirs) == 1, (
        f"prisma/migrations must have exactly 1 directory after squash; found {len(dirs)}: {dirs}"
    )


def test_baseline_migration_exists():
    assert os.path.isdir(BASELINE_DIR), (
        f"0001_baseline directory must exist at {BASELINE_DIR}"
    )


def test_baseline_sql_exists():
    assert os.path.isfile(BASELINE_SQL), (
        f"migration.sql must exist at {BASELINE_SQL}"
    )


def test_baseline_sql_has_create_table():
    with open(BASELINE_SQL) as f:
        sql = f.read()
    assert "CREATE TABLE" in sql.upper(), (
        "migration.sql must contain CREATE TABLE statements"
    )


def test_migrate_status_no_pending():
    """Priority 2: Use Prisma CLI to verify no pending migrations."""
    result = subprocess.run(
        ["npx", "prisma", "migrate", "status"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    combined = result.stdout + result.stderr
    # Prisma exits non-zero when there are pending migrations
    assert result.returncode == 0 or "up to date" in combined.lower() or "no pending" in combined.lower(), (
        f"prisma migrate status must show no pending migrations; got: {combined[:500]}"
    )


def test_db_still_functional():
    """Priority 1: Confirm DB is still queryable after squash."""
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.user.count().then(n => { console.log(n); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, (
        f"DB must still be queryable after migration squash; stderr={result.stderr.strip()}"
    )
