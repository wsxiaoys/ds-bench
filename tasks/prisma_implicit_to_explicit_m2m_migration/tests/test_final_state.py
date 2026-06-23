import os
import json
import subprocess

PROJECT_DIR = "/home/user/myproject"
SCHEMA_PATH = os.path.join(PROJECT_DIR, "prisma", "schema.prisma")
MIGRATIONS_DIR = os.path.join(PROJECT_DIR, "prisma", "migrations")
RESULT_FILE = os.path.join(PROJECT_DIR, "m2m_migrate_result.json")


def test_schema_has_post_tag_model():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "model PostTag" in content, "schema.prisma must have PostTag model"


def test_schema_post_tag_has_added_at():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "addedAt" in content, "PostTag must have addedAt field"


def test_migration_exists():
    dirs = [d for d in os.listdir(MIGRATIONS_DIR)
            if os.path.isdir(os.path.join(MIGRATIONS_DIR, d))]
    assert any("implicit_to_explicit" in d or "explicit" in d.lower() for d in dirs), (
        f"Migration 'implicit_to_explicit_m2m' must exist; found: {dirs}"
    )


def test_migrate_script_runs():
    """Priority 1: Execute the agent's data migration script."""
    result = subprocess.run(
        ["node", "migrate_m2m.js"], capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"node migrate_m2m.js must exit 0; stderr={result.stderr.strip()}"


def test_result_file_exists():
    assert os.path.isfile(RESULT_FILE), f"m2m_migrate_result.json must exist at {RESULT_FILE}"


def test_migrated_count():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("migratedCount", 0) >= 2, (
        f"migratedCount must be >= 2 (existing data must be migrated); got: {data.get('migratedCount')}"
    )


def test_post_tag_count_in_db():
    """Priority 1: Confirm via live DB query."""
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.postTag.count().then(n => { console.log(n); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"postTag.count() must succeed; stderr={result.stderr.strip()}"
    count = int(result.stdout.strip())
    assert count >= 2, f"PostTag table must have >= 2 records; found {count}"
